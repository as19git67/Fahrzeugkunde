/**
 * POST /api/admin/vehicles/import
 *
 * Nimmt ein .fzk-Paket (multipart/form-data, Feld `file`) entgegen und legt
 * daraus ein neues Fahrzeug in der Datenbank an. Die im Paket enthaltenen
 * Assets werden in `public/uploads/...` mit neuen, eindeutigen Dateinamen
 * abgelegt, um Kollisionen mit bestehenden Uploads auszuschließen.
 *
 * Fehlerbehandlung:
 *  - Validierungsfehler (Manifest, Checksum, fehlende Referenzen, …) → 400
 *  - DB-Transaktionen werden atomar ausgeführt; bei Fehler werden alle
 *    geschriebenen Asset-Dateien wieder entfernt (Rollback).
 *
 * Der aufgerufene Benutzer muss eingeloggt sein (wie /api/admin/reset-seed).
 */
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/db";
import {
  collectReferencedAssetPaths,
  generateUploadFilename,
  PACKAGE_ASSET_PREFIX,
  PackageValidationError,
  readPackageZip,
  safeExtFromPath,
  UPLOAD_DIR,
  UPLOAD_URL_PREFIX,
} from "@/lib/vehicle-package";
import { insertVehicleTree, makeRewriter } from "@/lib/vehicle-import";

/**
 * Asset-Pfad aus dem Paket (z. B. "assets/items/seed/foo.svg") auf einen
 * sicheren Ziel-Unterordner unter public/uploads/ abbilden. Aus dem Paket-Pfad
 * werden die Zwischenordner übernommen, jeder Segmentname aber streng
 * validiert (a–z, 0–9, Unterstrich, Bindestrich). Als Dateiname wird ein neu
 * generierter, kollisionsfreier Name gewählt.
 *
 * Gibt `null` zurück, wenn der Pfad keinen gültigen Ordner-Teil enthält oder
 * ein Segment bösartig aussieht (z. B. Punkt-Segmente, Backslashes).
 */
function resolveTargetForAsset(pkgPath: string): {
  relFolder: string;
  absFolder: string;
  relPath: string;
  absPath: string;
} | null {
  if (!pkgPath.startsWith(PACKAGE_ASSET_PREFIX)) return null;
  const rel = pkgPath.slice(PACKAGE_ASSET_PREFIX.length);
  const parts = rel.split("/");
  if (parts.length < 2) return null; // muss mindestens Ordner + Dateiname haben
  const folderSegments = parts.slice(0, -1);
  for (const seg of folderSegments) {
    if (!/^[a-z0-9_-]{1,32}$/i.test(seg)) return null;
  }
  const ext = safeExtFromPath(pkgPath);
  const newName = generateUploadFilename(ext);
  const relFolder = folderSegments.join("/");
  const absFolder = path.join(UPLOAD_DIR, ...folderSegments);
  const absPath = path.join(absFolder, newName);
  // Absicherung: resultierender Pfad muss innerhalb UPLOAD_DIR liegen
  const resolved = path.resolve(absPath);
  if (!resolved.startsWith(path.resolve(UPLOAD_DIR) + path.sep)) return null;
  return {
    relFolder,
    absFolder,
    relPath: `${relFolder}/${newName}`,
    absPath,
  };
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei (Feld 'file') übermittelt" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // 1) Paket lesen und validieren (Manifest, Checksums, Pfade)
  let parsed;
  try {
    parsed = readPackageZip(buf);
  } catch (err) {
    if (err instanceof PackageValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  const { manifest, vehicle, assets } = parsed;

  // 2) Alle im vehicle-JSON referenzierten Assets müssen vorhanden sein
  const refs = collectReferencedAssetPaths(vehicle);
  for (const r of refs) {
    if (!assets.has(r)) {
      return NextResponse.json(
        { error: `Referenziertes Asset fehlt im Paket: ${r}` },
        { status: 400 }
      );
    }
  }

  // 3) Assets auf die Festplatte schreiben (unter neuen, eindeutigen Namen).
  //    Ergebnis: Map Paket-Pfad → neuer DB-Pfad ("/api/uploads/...").
  const pathMap = new Map<string, string>();
  const writtenAbsPaths: string[] = [];
  try {
    for (const pkgPath of refs) {
      const target = resolveTargetForAsset(pkgPath);
      if (!target) {
        throw new PackageValidationError(`Ungültiger Asset-Pfad im Paket: ${pkgPath}`);
      }
      await fs.mkdir(target.absFolder, { recursive: true });
      await fs.writeFile(target.absPath, assets.get(pkgPath)!);
      writtenAbsPaths.push(target.absPath);
      pathMap.set(pkgPath, UPLOAD_URL_PREFIX + target.relPath);
    }
  } catch (err) {
    // Alle bereits geschriebenen Dateien aufräumen
    await cleanupFiles(writtenAbsPaths);
    if (err instanceof PackageValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("vehicle import: asset write failed", err);
    return NextResponse.json(
      { error: "Fehler beim Schreiben der Bilder" },
      { status: 500 }
    );
  }

  const rewrite = makeRewriter(pathMap);

  // 4) Datenbank-Inserts innerhalb einer Transaktion
  let newVehicleId: number;
  try {
    newVehicleId = await db.transaction(async (tx) =>
      insertVehicleTree(tx, vehicle, rewrite)
    );
  } catch (err) {
    // DB-Rollback ist durch die Transaktion erfolgt – nun die bereits
    // geschriebenen Asset-Dateien löschen, damit nichts Verwaistes zurückbleibt.
    await cleanupFiles(writtenAbsPaths);
    console.error("vehicle import: db transaction failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unbekannter Fehler beim Import" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    vehicleId: newVehicleId,
    vehicleName: vehicle.name,
    assetsWritten: writtenAbsPaths.length,
    schemaVersion: manifest.schemaVersion,
  });
}

async function cleanupFiles(absPaths: string[]): Promise<void> {
  await Promise.all(
    absPaths.map((p) => fs.unlink(p).catch(() => {}))
  );
}
