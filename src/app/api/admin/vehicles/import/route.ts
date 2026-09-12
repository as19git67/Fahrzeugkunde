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
 * Der aufgerufene Benutzer muss Administrator sein (role = 'admin'),
 * analog zu /api/admin/reset-seed.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { db } from "@/db";
import {
  collectReferencedAssetPaths,
  MAX_PACKAGE_BYTES,
  PackageValidationError,
  readPackageZip,
  resolveTargetForAsset,
  UPLOAD_URL_PREFIX,
  validatePackageAssets,
} from "@/lib/vehicle-package";
import { insertVehicleTree, makeRewriter } from "@/lib/vehicle-import";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }
  if (!isAdmin(user)) {
    return NextResponse.json(
      { error: "Nur Administratoren dürfen Fahrzeuge importieren." },
      { status: 403 }
    );
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
  // Route Handler haben keine Body-Grenze – vor dem Einlesen in den Speicher deckeln.
  if (file.size > MAX_PACKAGE_BYTES) {
    return NextResponse.json(
      { error: `Paket zu groß (max. ${MAX_PACKAGE_BYTES / 1024 / 1024} MB)` },
      { status: 413 }
    );
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

  // 2b) Bild-Assets inhaltlich prüfen (Magic Bytes, Endung, SVG-Sicherheit),
  //     bevor irgendetwas auf die Platte geschrieben wird.
  try {
    validatePackageAssets(assets, refs);
  } catch (err) {
    if (err instanceof PackageValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
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
