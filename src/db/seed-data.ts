/**
 * Wiederverwendbare Seed-Logik: legt ein Demo-HLF 20 mit vollständiger
 * Hierarchie (Views → Compartments → Positions → Boxes → Items) an.
 * Wird sowohl vom CLI-Seed (src/db/seed.ts) als auch von Tests genutzt.
 */
import type { Pool, Client } from "pg";

type Queryable = Pool | Client;

export interface SeedResult {
  vehicleId: number;
  viewIds: { left: number; right: number; back: number; top: number };
  compartmentIds: Record<string, number>; // "G1" → id
  positionIds: Record<string, number>;    // "G1:oben links" → id
  boxIds: Record<string, number>;         // "G1:unten rechts:orange Kiste" → id
  itemCount: number;
}

export async function seedDemoVehicle(client: Queryable): Promise<SeedResult> {
  const vehicleRes = await client.query(
    "INSERT INTO vehicles (name, description) VALUES ($1, $2) RETURNING id",
    ["HLF 20", "Hilfeleistungslöschgruppenfahrzeug 20"]
  );
  const vehicleId: number = vehicleRes.rows[0].id;

  // Ansichten
  const viewDefs = [
    { side: "left",  label: "Fahrzeug links",  imagePath: "/uploads/views/hlf_left.svg",  sortOrder: 0 },
    { side: "right", label: "Fahrzeug rechts", imagePath: "/uploads/views/hlf_right.svg", sortOrder: 1 },
    { side: "back",  label: "Fahrzeug hinten", imagePath: "/uploads/views/hlf_back.svg",  sortOrder: 2 },
    { side: "top",   label: "Fahrzeug oben",   imagePath: "/uploads/views/hlf_top.svg",   sortOrder: 3 },
  ];
  const viewIds: SeedResult["viewIds"] = { left: 0, right: 0, back: 0, top: 0 };
  for (const v of viewDefs) {
    const r = await client.query(
      "INSERT INTO vehicle_views (vehicle_id, side, label, image_path, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [vehicleId, v.side, v.label, v.imagePath, v.sortOrder]
    );
    viewIds[v.side as keyof SeedResult["viewIds"]] = r.rows[0].id;
  }

  // Compartments
  const compartmentIds: Record<string, number> = {};
  const compsLeft = ["G1", "G2", "G3", "G4"];
  for (let i = 0; i < compsLeft.length; i++) {
    const r = await client.query(
      "INSERT INTO compartments (view_id, label, sort_order) VALUES ($1,$2,$3) RETURNING id",
      [viewIds.left, compsLeft[i], i]
    );
    compartmentIds[compsLeft[i]] = r.rows[0].id;
  }
  const compsRight = ["G5", "G6", "G7", "G8"];
  for (let i = 0; i < compsRight.length; i++) {
    const r = await client.query(
      "INSERT INTO compartments (view_id, label, sort_order) VALUES ($1,$2,$3) RETURNING id",
      [viewIds.right, compsRight[i], i]
    );
    compartmentIds[compsRight[i]] = r.rows[0].id;
  }

  // Positionen (reine Orte — keine Kisten)
  const positionDefs: Array<{ comp: string; labels: string[] }> = [
    { comp: "G1", labels: ["oben links", "oben rechts", "unten links", "unten rechts"] },
    { comp: "G2", labels: ["vorne", "hinten", "Haken oben"] },
    { comp: "G5", labels: ["oben", "unten links", "unten rechts"] },
  ];
  const positionIds: Record<string, number> = {};
  for (const pd of positionDefs) {
    for (let i = 0; i < pd.labels.length; i++) {
      const r = await client.query(
        "INSERT INTO positions (compartment_id, label, sort_order) VALUES ($1,$2,$3) RETURNING id",
        [compartmentIds[pd.comp], pd.labels[i], i]
      );
      positionIds[`${pd.comp}:${pd.labels[i]}`] = r.rows[0].id;
    }
  }

  // Boxes (optionale Kiste-Ebene)
  const boxIds: Record<string, number> = {};
  const g1UntenRechts = positionIds["G1:unten rechts"];
  const bRes = await client.query(
    "INSERT INTO boxes (position_id, label, sort_order) VALUES ($1,$2,$3) RETURNING id",
    [g1UntenRechts, "orange Kiste", 0]
  );
  boxIds["G1:unten rechts:orange Kiste"] = bRes.rows[0].id;

  // Items
  const items: Array<{
    name: string; desc: string; cat: string; diff: number;
    posKey: string; boxKey: string | null; loc: string;
  }> = [
    { name: "Seilwinde",        desc: "Zum Ziehen schwerer Lasten",      cat: "bergung",     diff: 2, posKey: "G1:unten rechts", boxKey: "G1:unten rechts:orange Kiste", loc: "G1, unten rechts, orange Kiste" },
    { name: "Schutzmulde",      desc: "Auffangwanne für Gefahrenstoffe", cat: "gefahrgut",   diff: 2, posKey: "G1:oben links",   boxKey: null, loc: "G1, oben links" },
    { name: "Rettungsschere",   desc: "Hydraulisches Schneidwerkzeug",   cat: "bergung",     diff: 1, posKey: "G2:vorne",         boxKey: null, loc: "G2, vorne" },
    { name: "Rettungszylinder", desc: "Hydraulischer Spreizer",          cat: "bergung",     diff: 2, posKey: "G2:vorne",         boxKey: null, loc: "G2, vorne" },
    { name: "Atemschutzgerät",  desc: "Pressluftatemschutz PA",          cat: "atemschutz",  diff: 1, posKey: "G5:oben",          boxKey: null, loc: "G5, oben" },
    { name: "Handlampe",        desc: "Tragbare LED-Handlampe",          cat: "beleuchtung", diff: 1, posKey: "G5:unten links",   boxKey: null, loc: "G5, unten links" },
    { name: "Mehrzweckzug",     desc: "Handseilzug für Bergungen",       cat: "bergung",     diff: 3, posKey: "G1:oben links",    boxKey: null, loc: "G1, oben links" },
    { name: "Trennschleifer",   desc: "Elektrisches Schneidwerkzeug",    cat: "werkzeug",    diff: 2, posKey: "G2:vorne",         boxKey: null, loc: "G2, vorne" },
    { name: "Tempest Lüfter",   desc: "Hochleistungs-Belüftungsgerät",   cat: "belüftung",   diff: 2, posKey: "G5:unten links",   boxKey: null, loc: "G5, unten links" },
    { name: "Sanitätskoffer",   desc: "Erste-Hilfe Ausrüstung",          cat: "sanitaet",    diff: 1, posKey: "G5:oben",          boxKey: null, loc: "G5, oben" },
  ];

  for (const it of items) {
    await client.query(
      "INSERT INTO items (vehicle_id, name, description, category, difficulty, position_id, box_id, location_label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [vehicleId, it.name, it.desc, it.cat, it.diff, positionIds[it.posKey], it.boxKey ? boxIds[it.boxKey] : null, it.loc]
    );
  }

  return { vehicleId, viewIds, compartmentIds, positionIds, boxIds, itemCount: items.length };
}
