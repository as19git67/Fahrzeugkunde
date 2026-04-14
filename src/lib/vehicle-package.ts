/**
 * Fahrzeug-Paket (.fzk): gemeinsame Typen und Hilfsfunktionen
 * für Export und Import.
 *
 * Paketaufbau (ZIP):
 *   manifest.json          – Metadaten (Schema-Version, App, Zeitstempel, Checksum-Liste)
 *   vehicle.json           – Fahrzeug-Struktur (Views → Compartments → Positions → Boxes → Items)
 *   assets/…               – Bilder (relative Pfade, im JSON referenziert)
 *
 * Bildpfade in der DB sehen aus wie "/api/uploads/items/xyz.jpg". Beim Export
 * werden sie aufgelöst und durch relative Paket-Pfade "assets/items/xyz.jpg"
 * ersetzt. Beim Import werden sie umgekehrt in neue, eindeutige Upload-Pfade
 * unter "/api/uploads/..." überführt.
 */
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { createZip, type ZipEntry } from "./zip";

/** Schema-Version des Paketformats. Bei Breaking Changes erhöhen. */
export const PACKAGE_SCHEMA_VERSION = 1;

/** Magic-String im Manifest, um das Format eindeutig zu identifizieren. */
export const PACKAGE_MAGIC = "fahrzeugkunde-vehicle-package";

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
export const UPLOAD_URL_PREFIX = "/api/uploads/";
export const PACKAGE_ASSET_PREFIX = "assets/";

export interface PackageManifest {
  magic: typeof PACKAGE_MAGIC;
  schemaVersion: number;
  appName: "fahrzeugkunde";
  exportedAt: string; // ISO 8601
  vehicle: {
    name: string;
    description: string | null;
  };
  /** SHA-256 je Asset-Datei (Pfad → Hex). Ermöglicht Integritätsprüfung beim Import. */
  assetChecksums: Record<string, string>;
}

/** Hotspot-Koordinaten – in mehreren Tabellen identisch. */
interface Hotspot {
  hotspotX: number | null;
  hotspotY: number | null;
  hotspotW: number | null;
  hotspotH: number | null;
}

export interface PackageItem {
  name: string;
  article: string | null;
  description: string | null;
  imagePath: string | null;
  silhouettePath: string | null;
  category: string | null;
  difficulty: number | null;
  locationLabel: string | null;
}

export interface PackageBox extends Hotspot {
  label: string;
  imagePath: string | null;
  sortOrder: number | null;
  items: PackageItem[];
}

export interface PackagePosition extends Hotspot {
  label: string;
  sortOrder: number | null;
  boxes: PackageBox[];
  items: PackageItem[]; // Items direkt in der Position (ohne Kiste)
}

export interface PackageCompartment extends Hotspot {
  label: string;
  imagePath: string | null;
  sortOrder: number | null;
  positions: PackagePosition[];
}

export interface PackageView {
  side: string;
  label: string;
  imagePath: string | null;
  sortOrder: number | null;
  compartments: PackageCompartment[];
}

export interface PackageVehicle {
  name: string;
  description: string | null;
  views: PackageView[];
}

/**
 * Löst einen DB-Bildpfad in einen absoluten Dateipfad auf dem Dateisystem auf.
 * Liefert `null`, wenn der Pfad kein lokaler Upload ist (z. B. externer Link).
 * Unterstützt beide Varianten, unter denen Bilder gespeichert werden:
 *   "/api/uploads/foo/bar.jpg"   (neuer Pfad, bevorzugt)
 *   "/uploads/foo/bar.jpg"       (legacy / static public/)
 */
export function resolveUploadFsPath(dbPath: string | null | undefined): string | null {
  if (!dbPath) return null;
  let rel: string | null = null;
  if (dbPath.startsWith(UPLOAD_URL_PREFIX)) {
    rel = dbPath.slice(UPLOAD_URL_PREFIX.length);
  } else if (dbPath.startsWith("/uploads/")) {
    rel = dbPath.slice("/uploads/".length);
  } else {
    return null; // z. B. vollständige URL – nicht mit-exportieren
  }
  // Pfad-Traversal unterbinden
  const segments = rel.split("/");
  for (const s of segments) {
    if (s === "" || s === "." || s === ".." || s.includes("\\")) return null;
  }
  const abs = path.resolve(UPLOAD_DIR, ...segments);
  if (!abs.startsWith(path.resolve(UPLOAD_DIR))) return null;
  return abs;
}

/**
 * Normalisiert einen DB-Bildpfad in den Paket-Pfad, der im `assets/`-Ordner
 * des ZIPs verwendet wird. Behält die Upload-Unterordnerstruktur bei
 * ("items/seed/foo.svg" bleibt "items/seed/foo.svg").
 */
export function uploadPathToPackagePath(dbPath: string): string | null {
  let rel: string | null = null;
  if (dbPath.startsWith(UPLOAD_URL_PREFIX)) {
    rel = dbPath.slice(UPLOAD_URL_PREFIX.length);
  } else if (dbPath.startsWith("/uploads/")) {
    rel = dbPath.slice("/uploads/".length);
  } else {
    return null;
  }
  return PACKAGE_ASSET_PREFIX + rel;
}

/**
 * Erzeugt einen dateisystem- und URL-sicheren Slug aus dem Fahrzeugnamen.
 * Für Dateinamen wie `vehicle-42-hlf-20-<timestamp>.fzk`.
 */
export function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // Diakritika entfernen
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "vehicle"
  );
}

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Baut die ZIP-Einträge für ein vollständiges Fahrzeug-Paket:
 *  - manifest.json
 *  - vehicle.json
 *  - assets/…
 *
 * Erwartet `vehicle` bereits mit rewriteten Bildpfaden, d. h. die Pfade in
 * `vehicle` sind entweder `null` oder beginnen mit `assets/`. Der Aufrufer ist
 * dafür verantwortlich, Bilder vom Dateisystem zu sammeln und in `assets` zu
 * übergeben.
 */
export async function buildPackageZip(params: {
  vehicle: PackageVehicle;
  /** Zuordnung Paket-Pfad (z. B. "assets/items/foo.jpg") → absoluter Dateipfad. */
  assetFiles: Map<string, string>;
}): Promise<Buffer> {
  const { vehicle, assetFiles } = params;

  // Assets einlesen – zusammen mit Checksums für Manifest
  const assetEntries: ZipEntry[] = [];
  const assetChecksums: Record<string, string> = {};
  // Sortieren für deterministische Paket-Bytes (wichtig für Tests/Diffs)
  const sortedAssetPaths = Array.from(assetFiles.keys()).sort();
  for (const pkgPath of sortedAssetPaths) {
    const fsPath = assetFiles.get(pkgPath)!;
    const data = await fs.readFile(fsPath);
    assetEntries.push({ name: pkgPath, data });
    assetChecksums[pkgPath] = sha256(data);
  }

  const manifest: PackageManifest = {
    magic: PACKAGE_MAGIC,
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    appName: "fahrzeugkunde",
    exportedAt: new Date().toISOString(),
    vehicle: {
      name: vehicle.name,
      description: vehicle.description,
    },
    assetChecksums,
  };

  const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
  const vehicleBuf = Buffer.from(JSON.stringify(vehicle, null, 2), "utf8");

  // Reihenfolge: manifest → vehicle → assets (manifest zuerst → schneller Validate)
  return createZip([
    { name: "manifest.json", data: manifestBuf },
    { name: "vehicle.json", data: vehicleBuf },
    ...assetEntries,
  ]);
}
