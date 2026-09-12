/**
 * Startup-Skript: Führt beim Container-Start Migration und Seed durch,
 * dann startet den Next.js Server. Alle Operationen sind idempotent.
 */
const { Client } = require("pg");
const { execSync, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

/**
 * Drop-in-Restore: Wenn der Benutzer eine Backup-Datei zu
 * /backups/restore.backup umbenennt und die App neu startet, wird der
 * komplette Stand (DB + /data/assets) aus der Datei wiederhergestellt.
 * Nach einem erfolgreichen Restore wird die Trigger-Datei auf
 * restore.backup.done-<ts> umbenannt – so läuft der Restore nicht erneut.
 */
const RESTORE_TRIGGER = "/backups/restore.backup";
const ASSETS_DIR = "/data/assets";

// Kopiert rekursiv nur Dateien, die im Ziel noch nicht existieren.
// So bleiben User-Uploads im Volume unverändert, fehlende Seed-Assets
// werden aus dem Image aber wieder aufgefüllt.
function copyMissing(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  fs.mkdirSync(destDir, { recursive: true });
  let added = 0;
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      added += copyMissing(src, dest);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
        added++;
      }
    }
  }
  return added;
}

// Spiegelt einen Ordner force-overwrite ins Ziel: vorhandene Dateien werden
// ueberschrieben, Dateien im Ziel die in der Quelle nicht mehr existieren
// werden geloescht. Wird nur fuer kuratierte Seed-Ordner verwendet
// (SEED_MIRROR_DIRS), niemals fuer User-Upload-Pfade.
function mirrorForce(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  fs.mkdirSync(destDir, { recursive: true });
  const srcEntries = new Set(fs.readdirSync(srcDir));
  let written = 0;
  // 1. Im Ziel ueberzaehlige Dateien entfernen
  if (fs.existsSync(destDir)) {
    for (const name of fs.readdirSync(destDir)) {
      if (!srcEntries.has(name)) {
        fs.rmSync(path.join(destDir, name), { recursive: true, force: true });
      }
    }
  }
  // 2. Quelle force-overwrite ins Ziel kopieren
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const src = path.join(srcDir, entry.name);
    const dest = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      written += mirrorForce(src, dest);
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      fs.copyFileSync(src, dest);
      written++;
    }
  }
  return written;
}

// Kuratierte Seed-Ordner, die beim Start 1:1 aus dem Image gespiegelt werden.
// Ausschliesslich seed/-Unterordner: Die Eltern items/ und views/ enthalten die
// Uploads aus dem Creator (Item-Bilder bzw. Fahrzeugansichten) und duerfen nie
// force-gespiegelt werden – sonst loescht jeder Neustart die Nutzerdateien.
const SEED_MIRROR_DIRS = [path.join("items", "seed"), path.join("views", "seed")];

// Alt-Ablageort der Seed-Ansichten (vor dem Umzug nach views/seed). Die Kopien
// im Volume werden entfernt, damit sie nicht als Leichen liegen bleiben;
// Creator-Uploads heissen nie so (<timestamp>_<zufall>.<ext>).
const LEGACY_SEED_VIEW_FILES = ["hlf_left.svg", "hlf_right.svg", "hlf_back.svg", "hlf_top.svg"]
  .map((name) => path.join("views", name));

// --- Uploads-Verzeichnis vorbereiten (Docker-Volume) ---
function setupUploads() {
  const dataAssets = "/data/assets";
  const publicUploads = path.join(__dirname, "public", "uploads");
  const bundledUploads = path.join(__dirname, "bundled-uploads");

  // Nur im Container mit /data Volume
  if (fs.existsSync("/data")) {
    fs.mkdirSync(dataAssets, { recursive: true });

    // Fehlende Seed-Assets (aus dem gebakten Image-Snapshot) ins persistente
    // Volume spiegeln. Ohne diesen Schritt liefert /_next/image?url=/uploads/...
    // nach dem ersten Deploy 404, weil der Symlink das public/uploads/-Verzeichnis
    // aus dem Image überdeckt.
    if (fs.existsSync(bundledUploads)) {
      const added = copyMissing(bundledUploads, dataAssets);
      if (added > 0) console.log(`📦 ${added} Seed-Asset(s) ins Volume kopiert`);

      // Kuratierte Seed-Ordner immer force-overwrite, damit neu generierte
      // Item-Icons und Fahrzeugansichten nach Re-Deploy wirksam werden.
      let refreshed = 0;
      for (const rel of SEED_MIRROR_DIRS) {
        refreshed += mirrorForce(
          path.join(bundledUploads, rel),
          path.join(dataAssets, rel)
        );
      }
      if (refreshed > 0) console.log(`♻️  ${refreshed} kuratierte Seed-Asset(s) aktualisiert`);

      // Seed-Ansichten am alten Ort (views/hlf_*.svg) aufraeumen – die DB-
      // Migration in schema.sql zeigt bereits auf views/seed/.
      let removed = 0;
      for (const rel of LEGACY_SEED_VIEW_FILES) {
        const legacy = path.join(dataAssets, rel);
        if (fs.existsSync(legacy)) {
          fs.rmSync(legacy, { force: true });
          removed++;
        }
      }
      if (removed > 0) console.log(`🧹 ${removed} alte Seed-Ansicht(en) aus views/ entfernt`);
    }

    // Prüfen, ob public/uploads bereits ein Symlink auf dataAssets ist
    let alreadyLinked = false;
    try {
      alreadyLinked = fs.readlinkSync(publicUploads) === dataAssets;
    } catch {
      // kein Symlink
    }

    if (!alreadyLinked) {
      fs.rmSync(publicUploads, { recursive: true, force: true });
      fs.symlinkSync(dataAssets, publicUploads);
    }
    console.log("📁 Uploads: /data/assets → public/uploads");
  }
}

// --- Migration: Tabellen anlegen (IF NOT EXISTS) ---
// Liest die DDL aus src/db/schema.sql — gleiche Datei, die auch die App
// (src/db/schema-sql.ts) verwendet. So kann das Schema nicht mehr zwischen
// Container-Start-Migration und App-Migration auseinanderlaufen.
const SCHEMA_SQL_PATH = path.join(__dirname, "src", "db", "schema.sql");

async function migrate(client) {
  const sql = fs.readFileSync(SCHEMA_SQL_PATH, "utf8");
  await client.query(sql);
  console.log("✅ Migration abgeschlossen");
}

// --- Seed: Demo-Fahrzeug HLF 20 mit kompletter Beladung (idempotent) ---
// Die Seed-Logik lebt in TypeScript (src/db/seed-data.ts) und wird beim Build
// per esbuild nach dist/seed-data.cjs gebuendelt (scripts/bundle-seed.mjs) –
// das Standalone-Image hat weder tsx noch die TS-Quellen. Frueher legte der
// Start nur ein LEERES "HLF 20" an; das Spiel war nicht spielbar, und weil
// "ein Fahrzeug existiert" als "Seed ist gelaufen" gilt, blockierte das
// leere Fahrzeug den Voll-Seed dauerhaft.
//
// Wichtig: Der Check darf NICHT nach dem Namen "HLF 20" suchen, sonst wuerde
// ein vom Benutzer umbenanntes Seed-Fahrzeug beim naechsten Start zu einem
// zweiten HLF 20 fuehren. Sobald ueberhaupt ein Fahrzeug existiert, hat der
// Seed schon gelaufen (oder der Benutzer hat manuell Fahrzeuge angelegt).
const SEED_BUNDLE_PATH = path.join(__dirname, "dist", "seed-data.cjs");

function loadBundledSeeder() {
  if (!fs.existsSync(SEED_BUNDLE_PATH)) {
    throw new Error(
      `Seed-Bundle fehlt: ${SEED_BUNDLE_PATH} – "npm run build" erzeugt es (scripts/bundle-seed.mjs).`
    );
  }
  return require(SEED_BUNDLE_PATH).seedDemoVehicle;
}

/**
 * @param client pg.Client oder pg.Pool
 * @param seedDemoVehicle Seed-Funktion; Default: das gebuendelte Modul.
 *   Tests uebergeben die TypeScript-Variante direkt.
 */
async function seed(client, seedDemoVehicle = loadBundledSeeder()) {
  const existing = await client.query("SELECT id, name FROM vehicles LIMIT 1");
  if (existing.rows.length > 0) {
    console.log(
      "✅ Seed: Fahrzeug bereits vorhanden (id:",
      existing.rows[0].id,
      "name:",
      existing.rows[0].name,
      "), Seed wird uebersprungen"
    );
    return null;
  }

  // Alles oder nichts: Ein Fehler mittendrin darf kein halbes Fahrzeug
  // hinterlassen. Fuer die Transaktion braucht es EINE Verbindung – bei einem
  // Pool also einen geliehenen Client.
  const isPool = typeof client.totalCount === "number";
  const conn = isPool ? await client.connect() : client;
  try {
    await conn.query("BEGIN");
    const result = await seedDemoVehicle(conn);
    await conn.query("COMMIT");
    console.log(
      `✅ Seed: HLF 20 mit ${result.itemCount} Gegenstaenden angelegt (id: ${result.vehicleId})`
    );
    return result;
  } catch (err) {
    await conn.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    if (isPool) conn.release();
  }
}

/**
 * Führt einen Drop-in-Restore aus, falls /backups/restore.backup existiert.
 *
 * Ablauf:
 *   1. Paket-Tarball in ein Temp-Verzeichnis auspacken
 *   2. manifest.json prüfen (Format-Kennung, Schema-Version)
 *   3. `pg_restore --clean --if-exists` auf die laufende DB
 *   4. /data/assets komplett ersetzen
 *   5. Trigger-Datei zu restore.backup.done-<ts> umbenennen
 *
 * Fehler werden geloggt und die Trigger-Datei bekommt das Suffix .failed-<ts>,
 * damit der nächste Start nicht erneut versucht, einen kaputten Dump
 * einzuspielen.
 */
function tryRestore() {
  if (!fs.existsSync(RESTORE_TRIGGER)) return false;

  console.log(`🔄 Drop-in-Restore erkannt: ${RESTORE_TRIGGER}`);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "fzk-restore-"));
  const stampedName = (suffix) => {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    return `${RESTORE_TRIGGER}.${suffix}-${ts}`;
  };

  try {
    // 1. Tarball auspacken
    execFileSync("tar", ["-xf", RESTORE_TRIGGER, "-C", work], { stdio: "inherit" });

    // 2. Manifest verifizieren
    const manifestPath = path.join(work, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      throw new Error("manifest.json fehlt im Backup-Paket");
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    if (manifest.format !== "fahrzeugkunde-backup") {
      throw new Error(`Unerwartetes Format: ${manifest.format}`);
    }
    if (manifest.schemaVersion !== 1) {
      throw new Error(
        `Nicht unterstützte Schema-Version: ${manifest.schemaVersion}`
      );
    }
    console.log(`   Format OK (erstellt am ${manifest.createdAt})`);

    // 3. DB wiederherstellen – --clean entfernt alle vorhandenen Objekte
    const dump = path.join(work, "db.dump");
    if (!fs.existsSync(dump)) {
      throw new Error("db.dump fehlt im Backup-Paket");
    }
    // Ein gültiger pg_dump custom-format Dump ist nie 0 Bytes (mindestens
    // der Header wird geschrieben). Eine leere Datei deutet auf ein defektes
    // Backup hin (z.B. pg_dump/Server-Versionsmismatch im Sidecar) – lieber
    // hart abbrechen, als die laufende DB mit --clean zu entleeren und
    // anschließend an einem Nullbyte-Archiv zu scheitern.
    if (fs.statSync(dump).size === 0) {
      throw new Error("db.dump ist leer – Backup ist defekt, Restore abgebrochen");
    }
    execFileSync(
      "pg_restore",
      [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        `--dbname=${DATABASE_URL}`,
        dump,
      ],
      { stdio: "inherit" }
    );
    console.log("   ✅ Datenbank wiederhergestellt");

    // 4. Assets wiederherstellen (nur im Container-Setup, das /data hat)
    const assetsTar = path.join(work, "assets.tar");
    if (fs.existsSync(assetsTar) && fs.existsSync("/data")) {
      // Der Tarball enthält "assets/..." – extrahieren nach /data erzeugt
      // wieder /data/assets.
      fs.rmSync(ASSETS_DIR, { recursive: true, force: true });
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
      execFileSync("tar", ["-xf", assetsTar, "-C", "/data"], { stdio: "inherit" });
      console.log("   ✅ Assets wiederhergestellt");
    }

    // 5. Trigger umbenennen, damit Restore nicht wiederholt wird
    const doneName = stampedName("done");
    fs.renameSync(RESTORE_TRIGGER, doneName);
    console.log(`✅ Restore abgeschlossen. Trigger umbenannt: ${doneName}`);
    return true;
  } catch (err) {
    console.error("❌ Restore fehlgeschlagen:", err.message || err);
    // Kaputte Trigger-Datei zur Seite legen, sonst endet der Container
    // in einer Restart-Schleife mit immer demselben Fehler.
    try {
      const failedName = stampedName("failed");
      fs.renameSync(RESTORE_TRIGGER, failedName);
      console.error(`   Trigger-Datei zur Seite gelegt: ${failedName}`);
    } catch {
      // ignore
    }
    throw err;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

// --- Main ---
async function main() {
  // Wichtig: Restore LÄUFT VOR setupUploads, damit das Mirror der Seed-
  // Assets die frisch wiederhergestellten Dateien nicht wieder überdeckt.
  const didRestore = tryRestore();
  if (didRestore) {
    console.log("ℹ️  Stand wurde aus Backup wiederhergestellt");
  }

  setupUploads();

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    await migrate(client);
    await seed(client);
  } finally {
    await client.end();
  }

  // Next.js Server starten
  console.log("🚀 Server wird gestartet...");
  require("./server.js");
}

// Nur beim direkten Start ausfuehren. Damit koennen Tests einzelne Helfer
// (z.B. seed()) importieren, ohne dass der komplette Startup-Flow losbricht.
if (require.main === module) {
  main().catch((err) => {
    console.error("❌ Startup fehlgeschlagen:", err);
    process.exit(1);
  });
}

module.exports = { seed, migrate, SEED_MIRROR_DIRS, SEED_BUNDLE_PATH };
