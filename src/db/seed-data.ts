/**
 * Wiederverwendbare Seed-Logik: legt ein Demo-HLF 20/16 mit vollständiger
 * Hierarchie (Views → Compartments → Positions → Boxes → Items) an.
 *
 * Die Compartments werden aus COMPARTMENT_DEFS gelesen (damit auch leere
 * Türen angelegt werden); Positionen und Kisten werden aus der Item-Liste
 * abgeleitet. Wird sowohl vom CLI-Seed (src/db/seed.ts) als auch von Tests
 * genutzt.
 */
import type { Pool, Client } from "pg";
import { COMPARTMENT_DEFS, HLF20_ITEMS, VIEW_DEFS, ItemSeed } from "./seed-hlf20";

type Queryable = Pool | Client;

export interface SeedResult {
  vehicleId: number;
  viewIds: Record<string, number>; // "left" → id
  compartmentIds: Record<string, number>; // "G1" → id
  positionIds: Record<string, number>; // "G1|oben links" → id
  boxIds: Record<string, number>; // "G1|oben links|orange Kiste" → id
  itemCount: number;
}

function posKey(comp: string, pos: string) {
  return `${comp}|${pos}`;
}
function boxKey(comp: string, pos: string, box: string) {
  return `${comp}|${pos}|${box}`;
}

export async function seedDemoVehicle(client: Queryable): Promise<SeedResult> {
  const vehicleRes = await client.query(
    "INSERT INTO vehicles (name, description) VALUES ($1, $2) RETURNING id",
    ["HLF 20", "Hilfeleistungslöschgruppenfahrzeug 20/16 – Musterbeladung nach DIN 14530-27"]
  );
  const vehicleId: number = vehicleRes.rows[0].id;

  // Ansichten
  const viewIds: Record<string, number> = {};
  for (let i = 0; i < VIEW_DEFS.length; i++) {
    const v = VIEW_DEFS[i];
    const r = await client.query(
      "INSERT INTO vehicle_views (vehicle_id, side, label, image_path, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [vehicleId, v.side, v.label, v.imagePath ?? null, i]
    );
    viewIds[v.side] = r.rows[0].id;
  }

  // Compartments (explizit, inkl. leerer Türen). sort_order pro View fortlaufend.
  const compartmentIds: Record<string, number> = {};
  const viewCounters: Record<string, number> = {};
  for (const c of COMPARTMENT_DEFS) {
    const sort = (viewCounters[c.view] = (viewCounters[c.view] ?? 0) + 1) - 1;
    const r = await client.query(
      "INSERT INTO compartments (view_id, label, sort_order) VALUES ($1,$2,$3) RETURNING id",
      [viewIds[c.view], c.label, sort]
    );
    compartmentIds[c.label] = r.rows[0].id;
  }

  // Positionen aus Items ableiten (eindeutig pro Compartment, in Vorkommensreihenfolge)
  const positionIds: Record<string, number> = {};
  const posCounters: Record<string, number> = {};
  for (const it of HLF20_ITEMS) {
    const key = posKey(it.compartment, it.position);
    if (positionIds[key] != null) continue;
    const compId = compartmentIds[it.compartment];
    if (compId == null) {
      throw new Error(
        `Seed: Item "${it.name}" referenziert unbekanntes Compartment "${it.compartment}" — in COMPARTMENT_DEFS ergänzen.`
      );
    }
    const sort = (posCounters[it.compartment] = (posCounters[it.compartment] ?? 0) + 1) - 1;
    const r = await client.query(
      "INSERT INTO positions (compartment_id, label, sort_order) VALUES ($1,$2,$3) RETURNING id",
      [compId, it.position, sort]
    );
    positionIds[key] = r.rows[0].id;
  }

  // Boxen innerhalb einer Position
  const boxIds: Record<string, number> = {};
  const boxCounters: Record<string, number> = {};
  for (const it of HLF20_ITEMS) {
    if (!it.box) continue;
    const key = boxKey(it.compartment, it.position, it.box);
    if (boxIds[key] != null) continue;
    const pKey = posKey(it.compartment, it.position);
    const sort = (boxCounters[pKey] = (boxCounters[pKey] ?? 0) + 1) - 1;
    const r = await client.query(
      "INSERT INTO boxes (position_id, label, sort_order) VALUES ($1,$2,$3) RETURNING id",
      [positionIds[pKey], it.box, sort]
    );
    boxIds[key] = r.rows[0].id;
  }

  // Items
  for (const it of HLF20_ITEMS) {
    const pKey = posKey(it.compartment, it.position);
    const bKey = it.box ? boxKey(it.compartment, it.position, it.box) : null;
    const location = buildLocationLabel(it);
    await client.query(
      `INSERT INTO items (vehicle_id, name, article, description, category, difficulty,
         position_id, box_id, location_label, image_path)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        vehicleId,
        it.name,
        it.article,
        it.description,
        it.category,
        it.difficulty,
        positionIds[pKey],
        bKey ? boxIds[bKey] : null,
        location,
        it.imagePath,
      ]
    );
  }

  return {
    vehicleId,
    viewIds,
    compartmentIds,
    positionIds,
    boxIds,
    itemCount: HLF20_ITEMS.length,
  };
}

function buildLocationLabel(it: ItemSeed): string {
  const parts = [it.compartment, it.position];
  if (it.box) parts.push(it.box);
  return parts.join(", ");
}
