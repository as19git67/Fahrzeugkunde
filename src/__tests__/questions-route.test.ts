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
        expect(q.locationOptions!.length).toBeGreaterThanOrEqual(1);
        expect(q.locationOptions!.length).toBeLessThanOrEqual(4);
        const correct = q.locationOptions!.filter((o) => o.correct);
        expect(correct.length).toBe(1);
        expect(correct[0].label).toBe(q.item.locationLabel);
      } else {
        // where_in_vehicle: Navigationsziel mit intakter Hierarchie
        expect(q.navigationTarget).toBeDefined();
        expect(q.navigationTarget!.viewId).toBeGreaterThan(0);
        expect(q.navigationTarget!.compartmentId).toBeGreaterThan(0);
        expect(q.navigationTarget!.positionId).toBeGreaterThan(0);
      }
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
