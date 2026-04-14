/**
 * Integrationstests für den kompletten Export → Import Round-Trip.
 *
 * Führt keinen HTTP-Request durch, sondern ruft dieselben Bibliotheksfunktionen
 * auf, die die API-Routen benutzen (buildPackageZip, readPackageZip,
 * insertVehicleTree). Der Round-Trip schreibt Assets in einen temporären Ordner
 * unterhalb von public/uploads/ (wird am Ende wieder aufgeräumt), damit der
 * reale `resolveUploadFsPath` die Pfade auflösen kann.
 */
import { it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { eq, sql } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs/promises";
import {
  getTestDb,
  getTestPool,
  cleanDb,
  closeDb,
  resetAndSeedDb,
  describeDb as describe,
} from "./db-helper";
import {
  vehicles,
  vehicleViews,
  compartments,
  positions,
  boxes,
  items,
} from "@/db/schema";
import {
  buildPackageZip,
  collectReferencedAssetPaths,
  generateUploadFilename,
  PACKAGE_ASSET_PREFIX,
  PACKAGE_MAGIC,
  readPackageZip,
  resolveUploadFsPath,
  safeExtFromPath,
  uploadPathToPackagePath,
  UPLOAD_DIR,
  UPLOAD_URL_PREFIX,
  type PackageBox,
  type PackageCompartment,
  type PackageItem,
  type PackagePosition,
  type PackageVehicle,
  type PackageView,
} from "@/lib/vehicle-package";
import { insertVehicleTree, makeRewriter } from "@/lib/vehicle-import";

const db = getTestDb();

/**
 * Temporärer Unterordner unterhalb von public/uploads/ für Testdateien.
 * Wir benutzen einen eindeutigen Namen, damit parallele / wiederholte Läufe
 * sich nicht in die Quere kommen, und löschen ihn am Ende restlos.
 */
const TEST_UPLOAD_SUBFOLDER = `test-roundtrip-${Date.now()}`;
const TEST_UPLOAD_DIR = path.join(UPLOAD_DIR, TEST_UPLOAD_SUBFOLDER);

beforeAll(async () => {
  await fs.mkdir(TEST_UPLOAD_DIR, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TEST_UPLOAD_DIR, { recursive: true, force: true });
  await cleanDb();
  await closeDb();
});

beforeEach(async () => {
  await cleanDb();
});

/**
 * Lädt einen Fahrzeug-Teilbaum aus der DB und baut daraus das PackageVehicle-
 * Objekt – exakt wie der Export-Endpunkt.
 */
async function buildPackageFromDb(vehicleId: number) {
  const [v] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
  const views = await db
    .select()
    .from(vehicleViews)
    .where(eq(vehicleViews.vehicleId, vehicleId))
    .orderBy(vehicleViews.sortOrder);

  const viewIds = views.map((x) => x.id);
  const comps =
    viewIds.length > 0
      ? await db
          .select()
          .from(compartments)
          .where(sql`${compartments.viewId} IN (${sql.join(viewIds, sql`, `)})`)
          .orderBy(compartments.sortOrder)
      : [];
  const compIds = comps.map((c) => c.id);
  const poss =
    compIds.length > 0
      ? await db
          .select()
          .from(positions)
          .where(
            sql`${positions.compartmentId} IN (${sql.join(compIds, sql`, `)})`
          )
          .orderBy(positions.sortOrder)
      : [];
  const posIds = poss.map((p) => p.id);
  const bxs =
    posIds.length > 0
      ? await db
          .select()
          .from(boxes)
          .where(sql`${boxes.positionId} IN (${sql.join(posIds, sql`, `)})`)
          .orderBy(boxes.sortOrder)
      : [];
  const its = await db.select().from(items).where(eq(items.vehicleId, vehicleId));

  const assetFiles = new Map<string, string>();
  const rewrite = (p: string | null | undefined): string | null => {
    if (!p) return null;
    const fsp = resolveUploadFsPath(p);
    if (!fsp) return p;
    const pkg = uploadPathToPackagePath(p);
    if (!pkg) return p;
    if (!assetFiles.has(pkg)) assetFiles.set(pkg, fsp);
    return pkg;
  };

  const pkgItem = (row: (typeof its)[number]): PackageItem => ({
    name: row.name,
    article: row.article,
    description: row.description,
    imagePath: rewrite(row.imagePath),
    silhouettePath: rewrite(row.silhouettePath),
    category: row.category,
    difficulty: row.difficulty,
    locationLabel: row.locationLabel,
  });

  const pkgBox = (row: (typeof bxs)[number]): PackageBox => ({
    label: row.label,
    imagePath: rewrite(row.imagePath),
    hotspotX: row.hotspotX,
    hotspotY: row.hotspotY,
    hotspotW: row.hotspotW,
    hotspotH: row.hotspotH,
    sortOrder: row.sortOrder,
    items: its.filter((i) => i.boxId === row.id).map(pkgItem),
  });

  const pkgPosition = (row: (typeof poss)[number]): PackagePosition => ({
    label: row.label,
    hotspotX: row.hotspotX,
    hotspotY: row.hotspotY,
    hotspotW: row.hotspotW,
    hotspotH: row.hotspotH,
    sortOrder: row.sortOrder,
    boxes: bxs.filter((b) => b.positionId === row.id).map(pkgBox),
    items: its.filter((i) => i.positionId === row.id && !i.boxId).map(pkgItem),
  });

  const pkgCompartment = (row: (typeof comps)[number]): PackageCompartment => ({
    label: row.label,
    imagePath: rewrite(row.imagePath),
    hotspotX: row.hotspotX,
    hotspotY: row.hotspotY,
    hotspotW: row.hotspotW,
    hotspotH: row.hotspotH,
    sortOrder: row.sortOrder,
    positions: poss.filter((p) => p.compartmentId === row.id).map(pkgPosition),
  });

  const pkgView = (row: (typeof views)[number]): PackageView => ({
    side: row.side,
    label: row.label,
    imagePath: rewrite(row.imagePath),
    sortOrder: row.sortOrder,
    compartments: comps.filter((c) => c.viewId === row.id).map(pkgCompartment),
  });

  const packageVehicle: PackageVehicle = {
    name: v.name,
    description: v.description,
    views: views.map(pkgView),
  };

  return { vehicle: packageVehicle, assetFiles };
}

/** Schreibt Assets nach TEST_UPLOAD_DIR und liefert die pathMap (Paket-Pfad → URL). */
async function writeAssetsToTestDir(
  parsedAssets: Map<string, Buffer>
): Promise<{ pathMap: Map<string, string>; writtenFiles: string[] }> {
  const pathMap = new Map<string, string>();
  const writtenFiles: string[] = [];
  for (const [pkgPath, data] of parsedAssets) {
    // Vorsatz aus "assets/…" entfernen, dann in TEST_UPLOAD_DIR ablegen.
    const rel = pkgPath.slice(PACKAGE_ASSET_PREFIX.length);
    const segments = rel.split("/");
    const folderSegs = segments.slice(0, -1);
    const ext = safeExtFromPath(pkgPath);
    const newName = generateUploadFilename(ext);
    const folder = path.join(TEST_UPLOAD_DIR, ...folderSegs);
    await fs.mkdir(folder, { recursive: true });
    const abs = path.join(folder, newName);
    await fs.writeFile(abs, data);
    writtenFiles.push(abs);
    // DB-Pfad: /api/uploads/<TEST_UPLOAD_SUBFOLDER>/<folderSegs>/<newName>
    const urlParts = [TEST_UPLOAD_SUBFOLDER, ...folderSegs, newName];
    pathMap.set(pkgPath, UPLOAD_URL_PREFIX + urlParts.join("/"));
  }
  return { pathMap, writtenFiles };
}

describe("Vehicle Package Export → Import Round-Trip", () => {
  it("reproduziert das HLF-20-Seed-Fahrzeug exakt", async () => {
    const seed = await resetAndSeedDb();

    // 1) Export
    const { vehicle: exported, assetFiles } = await buildPackageFromDb(
      seed.vehicleId
    );
    const zipBuf = await buildPackageZip({ vehicle: exported, assetFiles });

    // 2) Parsing + Validierung
    const parsed = readPackageZip(zipBuf);
    expect(parsed.manifest.magic).toBe(PACKAGE_MAGIC);
    expect(parsed.manifest.schemaVersion).toBe(1);
    expect(parsed.manifest.vehicle.name).toBe("HLF 20");

    // Jedes im vehicle.json referenzierte Asset ist im Paket enthalten.
    const refs = collectReferencedAssetPaths(parsed.vehicle);
    expect(refs.size).toBeGreaterThan(0);
    for (const r of refs) expect(parsed.assets.has(r)).toBe(true);

    // 3) Assets auf die Platte schreiben (Test-Unterordner)
    const { pathMap } = await writeAssetsToTestDir(parsed.assets);
    expect(pathMap.size).toBe(parsed.assets.size);

    // 4) In neuer DB-Transaktion das Fahrzeug neu anlegen
    const rewrite = makeRewriter(pathMap);
    const newId = await db.transaction(async (tx) =>
      insertVehicleTree(tx, parsed.vehicle, rewrite)
    );
    expect(newId).toBeGreaterThan(0);
    expect(newId).not.toBe(seed.vehicleId);

    // 5) Stückzahlen müssen identisch zum Original sein
    const p = await getTestPool();
    const sel = (sqlText: string) =>
      p.query<{ n: number }>(sqlText, [newId]).then((r) => r.rows[0].n);

    const newCounts = {
      views: await sel("SELECT count(*)::int AS n FROM vehicle_views WHERE vehicle_id=$1"),
      comps: await sel(
        "SELECT count(*)::int AS n FROM compartments c JOIN vehicle_views vv ON c.view_id=vv.id WHERE vv.vehicle_id=$1"
      ),
      positions: await sel(
        "SELECT count(*)::int AS n FROM positions pp JOIN compartments cc ON pp.compartment_id=cc.id JOIN vehicle_views vv ON cc.view_id=vv.id WHERE vv.vehicle_id=$1"
      ),
      boxes: await sel(
        "SELECT count(*)::int AS n FROM boxes b JOIN positions pp ON b.position_id=pp.id JOIN compartments cc ON pp.compartment_id=cc.id JOIN vehicle_views vv ON cc.view_id=vv.id WHERE vv.vehicle_id=$1"
      ),
      items: await sel("SELECT count(*)::int AS n FROM items WHERE vehicle_id=$1"),
    };

    const origCounts = {
      views: await p
        .query("SELECT count(*)::int AS n FROM vehicle_views WHERE vehicle_id=$1", [seed.vehicleId])
        .then((r) => r.rows[0].n),
      comps: await p
        .query(
          "SELECT count(*)::int AS n FROM compartments c JOIN vehicle_views vv ON c.view_id=vv.id WHERE vv.vehicle_id=$1",
          [seed.vehicleId]
        )
        .then((r) => r.rows[0].n),
      positions: await p
        .query(
          "SELECT count(*)::int AS n FROM positions pp JOIN compartments cc ON pp.compartment_id=cc.id JOIN vehicle_views vv ON cc.view_id=vv.id WHERE vv.vehicle_id=$1",
          [seed.vehicleId]
        )
        .then((r) => r.rows[0].n),
      boxes: await p
        .query(
          "SELECT count(*)::int AS n FROM boxes b JOIN positions pp ON b.position_id=pp.id JOIN compartments cc ON pp.compartment_id=cc.id JOIN vehicle_views vv ON cc.view_id=vv.id WHERE vv.vehicle_id=$1",
          [seed.vehicleId]
        )
        .then((r) => r.rows[0].n),
      items: seed.itemCount,
    };
    expect(newCounts).toEqual(origCounts);

    // 6) Bildpfade nach Import zeigen nun auf den Test-Upload-Ordner
    const samples = await db
      .select({ imagePath: items.imagePath })
      .from(items)
      .where(eq(items.vehicleId, newId))
      .limit(3);
    for (const s of samples) {
      if (s.imagePath) {
        expect(s.imagePath).toMatch(
          new RegExp(`^${UPLOAD_URL_PREFIX}${TEST_UPLOAD_SUBFOLDER}/`)
        );
      }
    }
  });

  it("kann zweimal importieren und erhält zwei unabhängige Fahrzeuge", async () => {
    const seed = await resetAndSeedDb();
    const { vehicle: exported, assetFiles } = await buildPackageFromDb(seed.vehicleId);
    const zipBuf = await buildPackageZip({ vehicle: exported, assetFiles });

    const parsed = readPackageZip(zipBuf);
    const { pathMap: map1 } = await writeAssetsToTestDir(parsed.assets);
    const id1 = await db.transaction(async (tx) =>
      insertVehicleTree(tx, parsed.vehicle, makeRewriter(map1))
    );
    const { pathMap: map2 } = await writeAssetsToTestDir(parsed.assets);
    const id2 = await db.transaction(async (tx) =>
      insertVehicleTree(tx, parsed.vehicle, makeRewriter(map2))
    );

    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(seed.vehicleId);
    const all = await db.select().from(vehicles).orderBy(vehicles.id);
    expect(all.map((v) => v.id)).toEqual(
      expect.arrayContaining([seed.vehicleId, id1, id2])
    );

    // Items pro Fahrzeug separat – keine Vermischung
    const c1 = (await db.select().from(items).where(eq(items.vehicleId, id1))).length;
    const c2 = (await db.select().from(items).where(eq(items.vehicleId, id2))).length;
    expect(c1).toBe(seed.itemCount);
    expect(c2).toBe(seed.itemCount);
  });

  it("importiert ein minimales Fahrzeug ohne Views und Items korrekt", async () => {
    const minimal: PackageVehicle = {
      name: "Leer-Fahrzeug",
      description: null,
      views: [],
    };
    const zipBuf = await buildPackageZip({
      vehicle: minimal,
      assetFiles: new Map(),
    });
    const parsed = readPackageZip(zipBuf);
    expect(parsed.assets.size).toBe(0);

    const id = await db.transaction(async (tx) =>
      insertVehicleTree(tx, parsed.vehicle, makeRewriter(new Map()))
    );

    const [v] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    expect(v.name).toBe("Leer-Fahrzeug");
    const vws = await db.select().from(vehicleViews).where(eq(vehicleViews.vehicleId, id));
    expect(vws).toHaveLength(0);
  });
});
