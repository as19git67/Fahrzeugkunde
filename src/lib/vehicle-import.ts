/**
 * DB-Insert-Logik für importierte Fahrzeug-Pakete.
 *
 * Wird sowohl von der HTTP-Route (`POST /api/admin/vehicles/import`) als auch
 * von den Integrationstests genutzt. Die Funktion ist rein DB-seitig:
 *  - sie schreibt keine Dateien,
 *  - sie erwartet, dass der Aufrufer bereits einen Asset-Pfad-Rewriter hat,
 *  - sie läuft idealerweise innerhalb einer Transaktion.
 *
 * Der `rewrite`-Callback übersetzt paket-interne Pfade ("assets/…") in die
 * später in der DB zu speichernden Pfade (z. B. "/api/uploads/items/xyz.jpg").
 */
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { vehicles, vehicleViews, compartments, positions, boxes, items } from "@/db/schema";
import {
  PACKAGE_ASSET_PREFIX,
  type PackageItem,
  type PackageVehicle,
} from "./vehicle-package";

/**
 * Akzeptiert sowohl die App-DB-Instanz als auch ein Drizzle-Transaktions-Objekt.
 * Der Schema-Typ wird bewusst locker gehalten (`Record<string, unknown>`), damit
 * sowohl untyped-schema-Instanzen (wie in src/db/index.ts) als auch
 * Test-DB-Instanzen passen.
 */
export type DbOrTx = PgDatabase<
  NodePgQueryResultHKT,
  Record<string, unknown>,
  ExtractTablesWithRelations<Record<string, unknown>>
>;

/** Standard-Rewriter: wendet die pathMap auf `assets/…`-Pfade an und lässt alles andere durch. */
export function makeRewriter(pathMap: Map<string, string>) {
  return (p: string | null | undefined): string | null => {
    if (!p) return null;
    if (p.startsWith(PACKAGE_ASSET_PREFIX)) return pathMap.get(p) ?? null;
    return p;
  };
}

/**
 * Legt das komplette Fahrzeug (Vehicle → Views → Compartments → Positions →
 * Boxes → Items) an und gibt die neu vergebene Vehicle-ID zurück.
 *
 * Läuft idealerweise innerhalb einer Transaktion; bei einem Fehler sorgt der
 * Aufrufer für Rollback.
 */
export async function insertVehicleTree(
  tx: DbOrTx,
  vehicle: PackageVehicle,
  rewrite: (p: string | null | undefined) => string | null
): Promise<number> {
  const [inserted] = await tx
    .insert(vehicles)
    .values({ name: vehicle.name, description: vehicle.description ?? null })
    .returning();
  const vehicleId = inserted.id;

  const insertItem = async (
    it: PackageItem,
    positionId: number | null,
    boxId: number | null
  ) => {
    await tx.insert(items).values({
      vehicleId,
      name: it.name,
      article: it.article ?? null,
      description: it.description ?? null,
      imagePath: rewrite(it.imagePath),
      silhouettePath: rewrite(it.silhouettePath),
      category: it.category ?? null,
      difficulty: it.difficulty ?? 1,
      positionId: positionId ?? null,
      boxId: boxId ?? null,
      locationLabel: it.locationLabel ?? null,
    });
  };

  for (const v of vehicle.views) {
    const [vv] = await tx
      .insert(vehicleViews)
      .values({
        vehicleId,
        side: v.side,
        label: v.label,
        imagePath: rewrite(v.imagePath),
        sortOrder: v.sortOrder ?? 0,
      })
      .returning();

    for (const c of v.compartments ?? []) {
      const [cc] = await tx
        .insert(compartments)
        .values({
          viewId: vv.id,
          label: c.label,
          imagePath: rewrite(c.imagePath),
          hotspotX: c.hotspotX,
          hotspotY: c.hotspotY,
          hotspotW: c.hotspotW,
          hotspotH: c.hotspotH,
          sortOrder: c.sortOrder ?? 0,
        })
        .returning();

      for (const p of c.positions ?? []) {
        const [pp] = await tx
          .insert(positions)
          .values({
            compartmentId: cc.id,
            label: p.label,
            hotspotX: p.hotspotX,
            hotspotY: p.hotspotY,
            hotspotW: p.hotspotW,
            hotspotH: p.hotspotH,
            sortOrder: p.sortOrder ?? 0,
          })
          .returning();

        for (const b of p.boxes ?? []) {
          const [bb] = await tx
            .insert(boxes)
            .values({
              positionId: pp.id,
              label: b.label,
              imagePath: rewrite(b.imagePath),
              hotspotX: b.hotspotX,
              hotspotY: b.hotspotY,
              hotspotW: b.hotspotW,
              hotspotH: b.hotspotH,
              sortOrder: b.sortOrder ?? 0,
            })
            .returning();

          for (const it of b.items ?? []) {
            await insertItem(it, pp.id, bb.id);
          }
        }

        for (const it of p.items ?? []) {
          await insertItem(it, pp.id, null);
        }
      }
    }
  }

  return vehicleId;
}
