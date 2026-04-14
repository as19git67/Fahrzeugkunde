/**
 * GET /api/admin/vehicles/[id]/export
 *
 * Liefert das komplette Fahrzeug (Struktur + referenzierte Bilder) als
 * .fzk-Paket (ZIP) zum Download. Nur Administratoren dürfen exportieren –
 * analog zu /api/admin/reset-seed.
 *
 * Die Bildpfade werden vor dem Export normalisiert: Aus DB-Pfaden wie
 * "/api/uploads/items/xyz.jpg" werden paket-interne Pfade
 * "assets/items/xyz.jpg", sodass der Import auf einer anderen Installation
 * die Bilder korrekt wieder einspielen kann – unabhängig von dortigen IDs.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, vehicles, vehicleViews, compartments, positions, boxes, items } from "@/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import {
  buildPackageZip,
  resolveUploadFsPath,
  slugifyName,
  uploadPathToPackagePath,
  type PackageBox,
  type PackageCompartment,
  type PackageItem,
  type PackagePosition,
  type PackageVehicle,
  type PackageView,
} from "@/lib/vehicle-package";

/**
 * Registriert einen Bildpfad in der Assets-Map und liefert den Paket-Pfad
 * zurück (oder den Originalpfad, falls er nicht lokal auflösbar ist – dann
 * bleibt er im Paket als externer Verweis erhalten).
 */
function rewriteImagePath(
  dbPath: string | null,
  assetFiles: Map<string, string>
): string | null {
  if (!dbPath) return null;
  const fsPath = resolveUploadFsPath(dbPath);
  if (!fsPath) return dbPath; // Externer / nicht auflösbarer Pfad – unverändert lassen
  const pkgPath = uploadPathToPackagePath(dbPath);
  if (!pkgPath) return dbPath;
  // Mehrfach referenzierte Bilder nur einmal im Paket ablegen
  if (!assetFiles.has(pkgPath)) {
    assetFiles.set(pkgPath, fsPath);
  }
  return pkgPath;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 });
  }
  if (!isAdmin(user)) {
    return NextResponse.json(
      { error: "Nur Administratoren dürfen Fahrzeuge exportieren." },
      { status: 403 }
    );
  }

  const { id } = await params;
  const vehicleId = Number.parseInt(id, 10);
  if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, vehicleId));
  if (!vehicle) {
    return NextResponse.json({ error: "Fahrzeug nicht gefunden" }, { status: 404 });
  }

  // Komplette Hierarchie in einem Rutsch laden – weniger Round-Trips als
  // geschachtelte Queries pro Ebene.
  const views = await db
    .select()
    .from(vehicleViews)
    .where(eq(vehicleViews.vehicleId, vehicleId))
    .orderBy(vehicleViews.sortOrder);

  const viewIds = views.map((v) => v.id);
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
          .where(sql`${positions.compartmentId} IN (${sql.join(compIds, sql`, `)})`)
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

  const pkgItem = (row: typeof its[number]): PackageItem => ({
    name: row.name,
    article: row.article,
    description: row.description,
    imagePath: rewriteImagePath(row.imagePath, assetFiles),
    silhouettePath: rewriteImagePath(row.silhouettePath, assetFiles),
    category: row.category,
    difficulty: row.difficulty,
    locationLabel: row.locationLabel,
  });

  const pkgBox = (row: typeof bxs[number]): PackageBox => ({
    label: row.label,
    imagePath: rewriteImagePath(row.imagePath, assetFiles),
    hotspotX: row.hotspotX,
    hotspotY: row.hotspotY,
    hotspotW: row.hotspotW,
    hotspotH: row.hotspotH,
    sortOrder: row.sortOrder,
    items: its.filter((i) => i.boxId === row.id).map(pkgItem),
  });

  const pkgPosition = (row: typeof poss[number]): PackagePosition => ({
    label: row.label,
    hotspotX: row.hotspotX,
    hotspotY: row.hotspotY,
    hotspotW: row.hotspotW,
    hotspotH: row.hotspotH,
    sortOrder: row.sortOrder,
    boxes: bxs.filter((b) => b.positionId === row.id).map(pkgBox),
    items: its.filter((i) => i.positionId === row.id && !i.boxId).map(pkgItem),
  });

  const pkgCompartment = (row: typeof comps[number]): PackageCompartment => ({
    label: row.label,
    imagePath: rewriteImagePath(row.imagePath, assetFiles),
    hotspotX: row.hotspotX,
    hotspotY: row.hotspotY,
    hotspotW: row.hotspotW,
    hotspotH: row.hotspotH,
    sortOrder: row.sortOrder,
    positions: poss.filter((p) => p.compartmentId === row.id).map(pkgPosition),
  });

  const pkgView = (row: typeof views[number]): PackageView => ({
    side: row.side,
    label: row.label,
    imagePath: rewriteImagePath(row.imagePath, assetFiles),
    sortOrder: row.sortOrder,
    compartments: comps.filter((c) => c.viewId === row.id).map(pkgCompartment),
  });

  const packageVehicle: PackageVehicle = {
    name: vehicle.name,
    description: vehicle.description,
    views: views.map(pkgView),
  };

  const zipBuf = await buildPackageZip({ vehicle: packageVehicle, assetFiles });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `vehicle-${vehicleId}-${slugifyName(vehicle.name)}-${timestamp}.fzk`;

  return new NextResponse(new Uint8Array(zipBuf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zipBuf.length),
      "Cache-Control": "no-store",
    },
  });
}
