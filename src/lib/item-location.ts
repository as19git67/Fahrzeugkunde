/**
 * Validierung der Gegenstands-Felder und des Aufbewahrungsorts.
 *
 * Die IDs von Position und Kiste kommen vom Client. Ohne Prüfung ließe sich
 * ein Gegenstand per PATCH in die Struktur eines fremden Fahrzeugs hängen –
 * der Fragengenerator lieferte dann Navigationsziele, die es in diesem
 * Fahrzeug gar nicht gibt.
 */
import { db, boxes, positions, compartments, vehicleViews } from "@/db";
import { eq } from "drizzle-orm";
import { positiveInt } from "./request";

export interface ItemFields {
  name?: string;
  article?: string | null;
  plural?: boolean;
  imagePath?: string | null;
  locationImagePath?: string | null;
  silhouettePath?: string | null;
  difficulty?: number;
  positionId?: number | null;
  boxId?: number | null;
}

const NULLABLE_STRING_FIELDS = [
  "article",
  "imagePath",
  "locationImagePath",
  "silhouettePath",
] as const;

/**
 * Übernimmt nur bekannte Felder in den erwarteten Typen. Unbekannte Felder
 * werden ignoriert, falsch typisierte melden einen Fehler (→ 400).
 */
export function pickItemFields(body: Record<string, unknown>): ItemFields | { error: string } {
  const out: ItemFields = {};

  if ("name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return { error: "name muss ein nicht-leerer Text sein" };
    }
    out.name = body.name.trim();
  }
  for (const key of NULLABLE_STRING_FIELDS) {
    if (key in body) {
      const v = body[key];
      if (v !== null && typeof v !== "string") return { error: `${key} muss Text oder null sein` };
      out[key] = v === "" ? null : (v as string | null);
    }
  }
  if ("plural" in body) {
    if (typeof body.plural !== "boolean") return { error: "plural muss true oder false sein" };
    out.plural = body.plural;
  }
  if ("difficulty" in body) {
    const d = body.difficulty;
    if (!Number.isInteger(d) || (d as number) < 1 || (d as number) > 3) {
      return { error: "difficulty muss 1, 2 oder 3 sein" };
    }
    out.difficulty = d as number;
  }
  for (const key of ["positionId", "boxId"] as const) {
    if (key in body) {
      const v = body[key];
      if (v === null || v === undefined) {
        out[key] = null;
      } else {
        const n = positiveInt(v);
        if (n === null) return { error: `${key} muss eine positive Ganzzahl oder null sein` };
        out[key] = n;
      }
    }
  }
  return out;
}

export interface ItemLocation {
  positionId: number | null;
  boxId: number | null;
}

export type ItemLocationResult =
  | { ok: true; location: ItemLocation }
  | { ok: false; error: string };

async function vehicleIdOfPosition(positionId: number): Promise<number | null> {
  const [row] = await db
    .select({ vehicleId: vehicleViews.vehicleId })
    .from(positions)
    .innerJoin(compartments, eq(compartments.id, positions.compartmentId))
    .innerJoin(vehicleViews, eq(vehicleViews.id, compartments.viewId))
    .where(eq(positions.id, positionId));
  return row?.vehicleId ?? null;
}

/**
 * Prüft, ob Position und/oder Kiste zum Fahrzeug gehören, und liefert die
 * normalisierte Zuordnung: Bei einer Kiste wird die Position aus der Kiste
 * übernommen (eine Kiste liegt immer in genau einer Position).
 */
export async function validateItemLocation(
  vehicleId: number,
  positionId: number | null,
  boxId: number | null
): Promise<ItemLocationResult> {
  if (boxId !== null) {
    const [box] = await db.select().from(boxes).where(eq(boxes.id, boxId));
    if (!box) return { ok: false, error: "Kiste existiert nicht." };
    if (positionId !== null && positionId !== box.positionId) {
      return { ok: false, error: "Kiste gehört nicht zur angegebenen Position." };
    }
    const owner = await vehicleIdOfPosition(box.positionId);
    if (owner !== vehicleId) {
      return { ok: false, error: "Kiste gehört nicht zu diesem Fahrzeug." };
    }
    return { ok: true, location: { positionId: box.positionId, boxId } };
  }
  if (positionId !== null) {
    const owner = await vehicleIdOfPosition(positionId);
    if (owner === null) return { ok: false, error: "Position existiert nicht." };
    if (owner !== vehicleId) {
      return { ok: false, error: "Position gehört nicht zu diesem Fahrzeug." };
    }
    return { ok: true, location: { positionId, boxId: null } };
  }
  return { ok: true, location: { positionId: null, boxId: null } };
}
