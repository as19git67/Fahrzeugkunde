/**
 * Wiederverwendbare Seed-Logik: legt ein Demo-HLF 20 an.
 *
 * Die konkreten Seed-Daten (Ansichten, Gegenstände) sind aktuell leer
 * (siehe seed-hlf20.ts). Das Fahrzeug wird trotzdem angelegt, damit der
 * Creator einen Ausgangspunkt zum Befüllen hat.
 *
 * Wird sowohl vom CLI-Seed (src/db/seed.ts) als auch von Tests genutzt.
 */
import type { Pool, Client } from "pg";
import { HLF20_ITEMS, VIEW_DEFS, ItemSeed } from "./seed-hlf20";

type Queryable = Pool | Client;

export interface SeedResult {
  vehicleId: number;
  viewIds: Record<string, number>;
  compartmentIds: Record<string, number>;
  positionIds: Record<string, number>;
  boxIds: Record<string, number>;
  itemCount: number;
}

function compKey(comp: string) {
  return comp;
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
    ["HLF 20", "Hilfeleistungslöschgruppenfahrzeug 20"]
  );
  const vehicleId: number = vehicleRes.rows[0].id;

  const viewIds: Record<string, number> = {};
  for (let i = 0; i < VIEW_DEFS.length; i++) {
    const v = VIEW_DEFS[i];
    const r = await client.query(
      "INSERT INTO vehicle_views (vehicle_id, side, label, image_path, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [vehicleId, v.side, v.label, v.imagePath ?? null, i]
    );
    viewIds[v.side] = r.rows[0].id;
  }

  const compartmentIds: Record<string, number> = {};
  const positionIds: Record<string, number> = {};
  const boxIds: Record<string, number> = {};

  const compMeta: Record<string, { view: string; sort: number }> = {};
  const viewCounters: Record<string, number> = {};
  for (const it of HLF20_ITEMS) {
    if (compMeta[it.compartment] == null) {
      viewCounters[it.view] = (viewCounters[it.view] ?? 0) + 1;
      compMeta[it.compartment] = { view: it.view, sort: viewCounters[it.view] - 1 };
    }
  }

  for (const [comp, meta] of Object.entries(compMeta)) {
    const r = await client.query(
      "INSERT INTO compartments (view_id, label, sort_order) VALUES ($1,$2,$3) RETURNING id",
      [viewIds[meta.view], comp, meta.sort]
    );
    compartmentIds[compKey(comp)] = r.rows[0].id;
  }

  const posSeen: Record<string, number> = {};
  for (const it of HLF20_ITEMS) {
    const key = posKey(it.compartment, it.position);
    if (positionIds[key] != null) continue;
    const idx = (posSeen[it.compartment] = (posSeen[it.compartment] ?? 0) + 1);
    const r = await client.query(
      "INSERT INTO positions (compartment_id, label, sort_order) VALUES ($1,$2,$3) RETURNING id",
      [compartmentIds[compKey(it.compartment)], it.position, idx - 1]
    );
    positionIds[key] = r.rows[0].id;
  }

  const boxSeen: Record<string, number> = {};
  for (const it of HLF20_ITEMS) {
    if (!it.box) continue;
    const key = boxKey(it.compartment, it.position, it.box);
    if (boxIds[key] != null) continue;
    const pKey = posKey(it.compartment, it.position);
    const idx = (boxSeen[pKey] = (boxSeen[pKey] ?? 0) + 1);
    const r = await client.query(
      "INSERT INTO boxes (position_id, label, sort_order) VALUES ($1,$2,$3) RETURNING id",
      [positionIds[pKey], it.box, idx - 1]
    );
    boxIds[key] = r.rows[0].id;
  }

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
