/**
 * Seed-Daten: Demo-Fahrzeug LF 20 mit Beispiel-Beladung
 * Aufruf: npx tsx src/db/seed.ts
 */
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "fahrzeugkunde.db");
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

// Fahrzeug
const vehicle = db
  .prepare("INSERT OR IGNORE INTO vehicles (name, description) VALUES (?, ?) RETURNING *")
  .get("LF 20", "Löschfahrzeug 20 – Demo") as { id: number } | undefined;

if (!vehicle) {
  const existing = db.prepare("SELECT id FROM vehicles WHERE name = 'LF 20'").get() as { id: number };
  console.log("Fahrzeug LF 20 bereits vorhanden (id:", existing.id, ")");
  db.close();
  process.exit(0);
}

const vId = vehicle.id;

// Ansichten
const views = [
  { side: "left",  label: "Fahrzeug links",   sortOrder: 0 },
  { side: "right", label: "Fahrzeug rechts",  sortOrder: 1 },
  { side: "back",  label: "Fahrzeug hinten",  sortOrder: 2 },
] as const;

for (const v of views) {
  db.prepare(
    "INSERT INTO vehicle_views (vehicle_id, side, label, sort_order) VALUES (?, ?, ?, ?)"
  ).run(vId, v.side, v.label, v.sortOrder);
}

const leftViewId = (db.prepare("SELECT id FROM vehicle_views WHERE vehicle_id = ? AND side = 'left'").get(vId) as { id: number }).id;
const rightViewId = (db.prepare("SELECT id FROM vehicle_views WHERE vehicle_id = ? AND side = 'right'").get(vId) as { id: number }).id;

// Fächer links
const compsLeft = ["G1", "G2", "G3", "G4"];
for (let i = 0; i < compsLeft.length; i++) {
  db.prepare(
    "INSERT INTO compartments (view_id, label, sort_order) VALUES (?, ?, ?)"
  ).run(leftViewId, compsLeft[i], i);
}

// Fächer rechts
const compsRight = ["G5", "G6", "G7"];
for (let i = 0; i < compsRight.length; i++) {
  db.prepare(
    "INSERT INTO compartments (view_id, label, sort_order) VALUES (?, ?, ?)"
  ).run(rightViewId, compsRight[i], i);
}

// Positionen für G1
const g1Id = (db.prepare("SELECT id FROM compartments WHERE view_id = ? AND label = 'G1'").get(leftViewId) as { id: number }).id;
const g1Positions = ["oben links", "oben rechts", "unten links", "orange Kiste"];
for (let i = 0; i < g1Positions.length; i++) {
  db.prepare("INSERT INTO positions (compartment_id, label, sort_order) VALUES (?, ?, ?)").run(g1Id, g1Positions[i], i);
}

const g2Id = (db.prepare("SELECT id FROM compartments WHERE view_id = ? AND label = 'G2'").get(leftViewId) as { id: number }).id;
const g2Positions = ["vorne", "hinten", "Haken oben"];
for (let i = 0; i < g2Positions.length; i++) {
  db.prepare("INSERT INTO positions (compartment_id, label, sort_order) VALUES (?, ?, ?)").run(g2Id, g2Positions[i], i);
}

const g5Id = (db.prepare("SELECT id FROM compartments WHERE view_id = ? AND label = 'G5'").get(rightViewId) as { id: number }).id;
const g5Positions = ["oben", "unten links", "unten rechts"];
for (let i = 0; i < g5Positions.length; i++) {
  db.prepare("INSERT INTO positions (compartment_id, label, sort_order) VALUES (?, ?, ?)").run(g5Id, g5Positions[i], i);
}

// Items
const g1OrangeKiste = (db.prepare("SELECT id FROM positions WHERE compartment_id = ? AND label = 'orange Kiste'").get(g1Id) as { id: number }).id;
const g1ObenLinks = (db.prepare("SELECT id FROM positions WHERE compartment_id = ? AND label = 'oben links'").get(g1Id) as { id: number }).id;
const g2Vorne = (db.prepare("SELECT id FROM positions WHERE compartment_id = ? AND label = 'vorne'").get(g2Id) as { id: number }).id;
const g5Oben = (db.prepare("SELECT id FROM positions WHERE compartment_id = ? AND label = 'oben'").get(g5Id) as { id: number }).id;
const g5UntenLinks = (db.prepare("SELECT id FROM positions WHERE compartment_id = ? AND label = 'unten links'").get(g5Id) as { id: number }).id;

const items = [
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

for (const item of items) {
  db.prepare(
    "INSERT INTO items (vehicle_id, name, description, category, difficulty, position_id, location_label) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(vId, item.name, item.desc, item.cat, item.diff, item.posId, item.loc);
}

console.log(`✅ Seed abgeschlossen: LF 20 mit ${items.length} Gegenständen angelegt (id: ${vId})`);
db.close();
