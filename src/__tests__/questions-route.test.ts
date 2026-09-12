import { it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { getTestPool, cleanDb, closeDb, describeDb as describe } from "./db-helper";
import { seedDemoVehicle } from "@/db/seed-data";
import type { Question } from "@/app/api/questions/route";

// Die Route importiert `db` aus `@/db`, das `DATABASE_URL` beim ersten Import
// auswertet und die Verbindung als Singleton cached. Lokal zeigt `DATABASE_URL`
// auf die Produktions-DB, daher hier auf die Test-DB umbiegen, BEVOR `@/db`
// (transitiv über die Route) geladen wird. Der Route-Import passiert deshalb
// dynamisch in beforeAll – statische Imports oben ziehen `@/db` nicht.
process.env.DATABASE_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING || process.env.DATABASE_URL;

let GET: typeof import("@/app/api/questions/route").GET;
let vehicleId: number;

async function fetchQuestions(params: Record<string, string | number>): Promise<Response> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  return GET(new NextRequest(`http://localhost/api/questions?${qs}`));
}

describe("questions route – Fragengenerierung", () => {
  beforeAll(async () => {
    ({ GET } = await import("@/app/api/questions/route"));
    await cleanDb();
    const seed = await seedDemoVehicle(await getTestPool());
    vehicleId = seed.vehicleId;
  });

  afterAll(async () => {
    await closeDb();
  });

  it("verlangt eine vehicleId (400)", async () => {
    const res = await fetchQuestions({ count: 5 });
    expect(res.status).toBe(400);
  });

  it("lehnt Fahrzeuge mit zu wenigen Items ab (422)", async () => {
    const pool = await getTestPool();
    const { rows } = await pool.query(
      "INSERT INTO vehicles (name) VALUES ($1) RETURNING id",
      ["Leeres Fahrzeug"]
    );
    const emptyId = rows[0].id as number;
    const res = await fetchQuestions({ vehicleId: emptyId });
    expect(res.status).toBe(422);
  });

  it("erzeugt genau die angeforderte Anzahl Fragen", async () => {
    const res = await fetchQuestions({ vehicleId, count: 30 });
    expect(res.status).toBe(200);
    const questions = (await res.json()) as Question[];
    expect(questions.length).toBe(30);
  });

  it("deckelt die Anzahl bei 50", async () => {
    const res = await fetchQuestions({ vehicleId, count: 999 });
    const questions = (await res.json()) as Question[];
    expect(questions.length).toBe(50);
  });

  it("jede Frage ist vollständig und vom Typ what_is / where_is / where_in_vehicle", async () => {
    const res = await fetchQuestions({ vehicleId, count: 40 });
    const questions = (await res.json()) as Question[];

    for (const q of questions) {
      expect(q.id).toBeTruthy();
      expect(["what_is", "where_is", "where_in_vehicle"]).toContain(q.type);
      expect(q.item).toBeTruthy();
      expect(typeof q.item.id).toBe("number");
      expect(q.item.name).toBeTruthy();
      expect(typeof q.item.plural).toBe("boolean");

      if (q.type === "what_is") {
        // 4 Namens-Optionen, eindeutige IDs, genau eine korrekte (= item.id)
        expect(q.options).toBeDefined();
        expect(q.options!.length).toBe(4);
        const ids = q.options!.map((o) => o.id);
        expect(new Set(ids).size).toBe(4);
        expect(ids).toContain(q.item.id);
      } else if (q.type === "where_is") {
        // Ortsoptionen mit genau einer korrekten, deren Label dem Item-Ort entspricht
        expect(q.locationOptions).toBeDefined();
        expect(q.locationOptions!.length).toBeGreaterThanOrEqual(2);
        expect(q.locationOptions!.length).toBeLessThanOrEqual(4);
        const correct = q.locationOptions!.filter((o) => o.correct);
        expect(correct.length).toBe(1);
        expect(correct[0].label).toBe(q.item.locationLabel);
        // Keine doppelten Ortstexte: mehrere Items können an derselben
        // Stelle liegen, als Antwortoption darf ein Ort nur einmal auftauchen.
        const labels = q.locationOptions!.map((o) => o.label);
        expect(new Set(labels).size).toBe(labels.length);
      } else {
        // where_in_vehicle: Navigationsziel mit intakter Hierarchie
        expect(q.navigationTarget).toBeDefined();
        expect(q.navigationTarget!.viewId).toBeGreaterThan(0);
        expect(q.navigationTarget!.compartmentId).toBeGreaterThan(0);
        expect(q.navigationTarget!.positionId).toBeGreaterThan(0);
      }
    }
  });

  it("leitet den Ortstext aus der Fahrzeugstruktur ab", async () => {
    // `location_label` gibt es nicht mehr — der Text muss aus Fach, Position
    // und ggf. Kiste entstehen und zur Verortung des Items passen.
    const pool = await getTestPool();
    const res = await fetchQuestions({ vehicleId, count: 50 });
    const questions = (await res.json()) as Question[];

    const located = questions.filter((q) => q.item.positionId || q.item.boxId);
    expect(located.length).toBeGreaterThan(0);

    for (const q of located) {
      const { rows } = await pool.query(
        `SELECT c.label AS compartment, p.label AS position, b.label AS box
           FROM positions p
           JOIN compartments c ON c.id = p.compartment_id
           LEFT JOIN boxes b ON b.id = $2
          WHERE p.id = COALESCE((SELECT position_id FROM boxes WHERE id = $2), $1)`,
        [q.item.positionId, q.item.boxId]
      );
      expect(rows.length).toBe(1);
      const parts = [rows[0].compartment, rows[0].position];
      if (rows[0].box) parts.push(rows[0].box);
      expect(q.item.locationLabel).toBe(parts.join(", "));
    }
  });

  /**
   * Kleines Fahrzeug mit `located` verorteten Gegenständen (mit Bild) und
   * `loose` unverorteten (nur Bild). Damit lassen sich Aussagen über die
   * Fragenauswahl deterministisch prüfen – im Demo-Fahrzeug mit 100+ Items
   * hinge alles am Zufall.
   */
  async function createMiniVehicle(located: number, loose: number): Promise<number> {
    const pool = await getTestPool();
    const v = await pool.query("INSERT INTO vehicles (name) VALUES ('Mini') RETURNING id");
    const vid = v.rows[0].id as number;
    const view = await pool.query(
      "INSERT INTO vehicle_views (vehicle_id, side, label) VALUES ($1,'left','links') RETURNING id",
      [vid]
    );
    const comp = await pool.query(
      "INSERT INTO compartments (view_id, label) VALUES ($1,'G1') RETURNING id",
      [view.rows[0].id]
    );
    for (let i = 0; i < located; i++) {
      const pos = await pool.query(
        "INSERT INTO positions (compartment_id, label) VALUES ($1,$2) RETURNING id",
        [comp.rows[0].id, `Platz ${i + 1}`]
      );
      await pool.query(
        "INSERT INTO items (vehicle_id, name, image_path, position_id) VALUES ($1,$2,$3,$4)",
        [vid, `Verortet ${i + 1}`, `/uploads/items/v${i + 1}.jpg`, pos.rows[0].id]
      );
    }
    for (let i = 0; i < loose; i++) {
      await pool.query(
        "INSERT INTO items (vehicle_id, name, image_path) VALUES ($1,$2,$3)",
        [vid, `Lose ${i + 1}`, `/uploads/items/l${i + 1}.jpg`]
      );
    }
    return vid;
  }

  it("bietet unverortete Gegenstände nur als „Was ist das?“ an", async () => {
    // 4 verortete + 1 loser Gegenstand, 5 Fragen → jeder kommt genau einmal
    // dran, der lose muss dabei als what_is erscheinen.
    const miniId = await createMiniVehicle(4, 1);
    const res = await fetchQuestions({ vehicleId: miniId, count: 5 });
    expect(res.status).toBe(200);
    const questions = (await res.json()) as Question[];
    expect(questions).toHaveLength(5);
    const loose = questions.filter((q) => q.item.name.startsWith("Lose"));
    expect(loose).toHaveLength(1);
    expect(loose[0].type).toBe("what_is");
    expect(loose[0].item.locationLabel).toBeNull();
  });

  it("stellt jeden Gegenstand höchstens einmal pro Spiel (Demo: 102 Items, 50 Fragen)", async () => {
    const res = await fetchQuestions({ vehicleId, count: 50 });
    const questions = (await res.json()) as Question[];
    expect(new Set(questions.map((q) => q.item.id)).size).toBe(50);
  });

  it("wiederholt bei zu wenigen Gegenständen nie direkt hintereinander", async () => {
    // 5 Gegenstände, 20 Fragen → jeder 4×, aber nie zwei gleiche nacheinander
    // (die erste Frage würde sonst die Antwort der zweiten verraten).
    const miniId = await createMiniVehicle(5, 0);
    const res = await fetchQuestions({ vehicleId: miniId, count: 20 });
    const questions = (await res.json()) as Question[];
    expect(questions).toHaveLength(20);
    const perItem = new Map<number, number>();
    for (const q of questions) perItem.set(q.item.id, (perItem.get(q.item.id) ?? 0) + 1);
    expect([...perItem.values()]).toEqual([4, 4, 4, 4, 4]);
    for (let i = 1; i < questions.length; i++) {
      expect(questions[i].item.id, `Frage ${i}`).not.toBe(questions[i - 1].item.id);
    }
  });

  it("verteilt die Fragetypen ausgewogen", async () => {
    // Alle Demo-Gegenstände unterstützen alle drei Typen → 30 Fragen = 10/10/10
    const res = await fetchQuestions({ vehicleId, count: 30 });
    const questions = (await res.json()) as Question[];
    const counts = { what_is: 0, where_is: 0, where_in_vehicle: 0 };
    for (const q of questions) counts[q.type]++;
    expect(counts).toEqual({ what_is: 10, where_is: 10, where_in_vehicle: 10 });
  });

  it("liefert Gegenstands- und Aufbewahrungsbild getrennt aus", async () => {
    // Beide Bilder sind eigenständige Spalten: `image_path` zeigt den
    // Gegenstand ("Was ist das?"), `location_image_path` die Stelle der
    // Aufbewahrung (Auflösung der Ortsfragen). Die Route darf sie nicht
    // vermischen.
    const pool = await getTestPool();
    await pool.query(
      "UPDATE items SET location_image_path = '/uploads/items/ort-' || id || '.jpg' WHERE vehicle_id = $1",
      [vehicleId]
    );

    const res = await fetchQuestions({ vehicleId, count: 40 });
    const questions = (await res.json()) as Question[];
    expect(questions.length).toBeGreaterThan(0);

    for (const q of questions) {
      expect(q.item.locationImagePath).toBe(`/uploads/items/ort-${q.item.id}.jpg`);
      expect(q.item.imagePath).not.toBe(q.item.locationImagePath);
    }
  });

  it("erzeugt über viele Fragen alle drei Fragetypen (Demo-Fahrzeug)", async () => {
    const res = await fetchQuestions({ vehicleId, count: 50 });
    const questions = (await res.json()) as Question[];
    const types = new Set(questions.map((q) => q.type));
    expect(types.has("what_is")).toBe(true);
    expect(types.has("where_is")).toBe(true);
    expect(types.has("where_in_vehicle")).toBe(true);
  });
});
