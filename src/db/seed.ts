/**
 * Seed-Daten: Demo-Fahrzeug HLF 20 mit Beispiel-Beladung
 * Aufruf: npx tsx src/db/seed.ts
 */
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/fahrzeugkunde";

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

// Fahrzeug
const vehicleRes = await client.query(
  "INSERT INTO vehicles (name, description) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING *",
  ["HLF 20", "Hilfeleistungslöschgruppenfahrzeug 20"]
);

let vId: number;
if (vehicleRes.rows.length === 0) {
  const existing = await client.query("SELECT id FROM vehicles WHERE name = 'HLF 20'");
  console.log("Fahrzeug HLF 20 bereits vorhanden (id:", existing.rows[0].id, ")");
  await client.end();
  process.exit(0);
} else {
  vId = vehicleRes.rows[0].id;
}

// Ansichten mit Bildern
const views = [
  { side: "left",  label: "Fahrzeug links",   imagePath: "/uploads/views/hlf_left.svg",  sortOrder: 0 },
  { side: "right", label: "Fahrzeug rechts",  imagePath: "/uploads/views/hlf_right.svg", sortOrder: 1 },
  { side: "back",  label: "Fahrzeug hinten",  imagePath: "/uploads/views/hlf_back.svg",  sortOrder: 2 },
  { side: "top",   label: "Fahrzeug oben",    imagePath: "/uploads/views/hlf_top.svg",   sortOrder: 3 },
];

for (const v of views) {
  await client.query(
    "INSERT INTO vehicle_views (vehicle_id, side, label, image_path, sort_order) VALUES ($1, $2, $3, $4, $5)",
    [vId, v.side, v.label, v.imagePath, v.sortOrder]
  );
}

const leftViewRes = await client.query(
  "SELECT id FROM vehicle_views WHERE vehicle_id = $1 AND side = 'left'", [vId]
);
const rightViewRes = await client.query(
  "SELECT id FROM vehicle_views WHERE vehicle_id = $1 AND side = 'right'", [vId]
);
const leftViewId = leftViewRes.rows[0].id;
const rightViewId = rightViewRes.rows[0].id;

// Fächer links
const compsLeft = ["G1", "G2", "G3", "G4"];
for (let i = 0; i < compsLeft.length; i++) {
  await client.query(
    "INSERT INTO compartments (view_id, label, sort_order) VALUES ($1, $2, $3)",
    [leftViewId, compsLeft[i], i]
  );
}

// Fächer rechts
const compsRight = ["G5", "G6", "G7", "G8"];
for (let i = 0; i < compsRight.length; i++) {
  await client.query(
    "INSERT INTO compartments (view_id, label, sort_order) VALUES ($1, $2, $3)",
    [rightViewId, compsRight[i], i]
  );
}

// Positionen für G1
const g1Res = await client.query(
  "SELECT id FROM compartments WHERE view_id = $1 AND label = 'G1'", [leftViewId]
);
const g1Id = g1Res.rows[0].id;
const g1Positions = ["oben links", "oben rechts", "unten links", "orange Kiste"];
for (let i = 0; i < g1Positions.length; i++) {
  await client.query(
    "INSERT INTO positions (compartment_id, label, sort_order) VALUES ($1, $2, $3)",
    [g1Id, g1Positions[i], i]
  );
}

const g2Res = await client.query(
  "SELECT id FROM compartments WHERE view_id = $1 AND label = 'G2'", [leftViewId]
);
const g2Id = g2Res.rows[0].id;
const g2Positions = ["vorne", "hinten", "Haken oben"];
for (let i = 0; i < g2Positions.length; i++) {
  await client.query(
    "INSERT INTO positions (compartment_id, label, sort_order) VALUES ($1, $2, $3)",
    [g2Id, g2Positions[i], i]
  );
}

const g5Res = await client.query(
  "SELECT id FROM compartments WHERE view_id = $1 AND label = 'G5'", [rightViewId]
);
const g5Id = g5Res.rows[0].id;
const g5Positions = ["oben", "unten links", "unten rechts"];
for (let i = 0; i < g5Positions.length; i++) {
  await client.query(
    "INSERT INTO positions (compartment_id, label, sort_order) VALUES ($1, $2, $3)",
    [g5Id, g5Positions[i], i]
  );
}

// Items
async function getPosId(compId: number, label: string): Promise<number> {
  const res = await client.query(
    "SELECT id FROM positions WHERE compartment_id = $1 AND label = $2", [compId, label]
  );
  return res.rows[0].id;
}

const g1OrangeKiste = await getPosId(g1Id, "orange Kiste");
const g1ObenLinks = await getPosId(g1Id, "oben links");
const g2Vorne = await getPosId(g2Id, "vorne");
const g5Oben = await getPosId(g5Id, "oben");
const g5UntenLinks = await getPosId(g5Id, "unten links");

const seedItems = [
  { name: "Seilwinde",           desc: "Zum Ziehen schwerer Lasten",      cat: "bergung",   diff: 2, posId: g1OrangeKiste, loc: "G1, orange Kiste" },
  { name: "Schutzmulde",         desc: "Auffangwanne für Gefahrenstoffe", cat: "gefahrgut", diff: 2, posId: g1ObenLinks,   loc: "G1, oben links" },
  { name: "Rettungsschere",      desc: "Hydraulisches Schneidwerkzeug",   cat: "bergung",   diff: 1, posId: g2Vorne,       loc: "G2, vorne" },
  { name: "Rettungszylinder",    desc: "Hydraulischer Spreizer",          cat: "bergung",   diff: 2, posId: g2Vorne,       loc: "G2, vorne" },
  { name: "Atemschutzgerät",     desc: "Pressluftatemschutz PA",          cat: "atemschutz",diff: 1, posId: g5Oben,        loc: "G5, oben" },
  { name: "Handlampe",           desc: "Tragbare LED-Handlampe",          cat: "beleuchtung",diff:1, posId: g5UntenLinks,  loc: "G5, unten links" },
  { name: "Mehrzweckzug",        desc: "Handseilzug für Bergungen",       cat: "bergung",   diff: 3, posId: g1ObenLinks,   loc: "G1, oben links" },
  { name: "Trennschleifer",      desc: "Elektrisches Schneidwerkzeug",    cat: "werkzeug",  diff: 2, posId: g2Vorne,       loc: "G2, vorne" },
  { name: "Tempest Lüfter",      desc: "Hochleistungs-Belüftungsgerät",   cat: "belüftung", diff: 2, posId: g5UntenLinks,  loc: "G5, unten links" },
  { name: "Sanitätskoffer",      desc: "Erste-Hilfe Ausrüstung",          cat: "sanitaet",  diff: 1, posId: g5Oben,        loc: "G5, oben" },
];

for (const item of seedItems) {
  await client.query(
    "INSERT INTO items (vehicle_id, name, description, category, difficulty, position_id, location_label) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [vId, item.name, item.desc, item.cat, item.diff, item.posId, item.loc]
  );
}

console.log(`✅ Seed abgeschlossen: HLF 20 mit ${seedItems.length} Gegenständen angelegt (id: ${vId})`);
await client.end();
