/**
 * Tests für GET /api/uploads/[...path]: Pfad-Traversal-Schutz und die
 * Schutz-Header, die verhindern, dass ein Upload als HTML interpretiert oder
 * ein SVG mit Script im App-Origin ausgeführt wird.
 *
 * Nutzt die im Repo liegenden Seed-Ansichten (public/uploads/views/seed/*.svg).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/uploads/[...path]/route";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const TXT_NAME = `test-serve-${Date.now()}.txt`;

function get(segs: string[]) {
  return GET(new NextRequest(`http://localhost/api/uploads/${segs.join("/")}`), {
    params: Promise.resolve({ path: segs }),
  });
}

beforeAll(async () => {
  await fs.writeFile(path.join(UPLOAD_DIR, "items", TXT_NAME), "kein Bild");
});
afterAll(async () => {
  await fs.unlink(path.join(UPLOAD_DIR, "items", TXT_NAME)).catch(() => {});
});

describe("GET /api/uploads/[...path]", () => {
  it("liefert ein Seed-SVG mit nosniff, CSP-Sandbox und als Download", async () => {
    const res = await get(["views", "seed", "hlf_left.svg"]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("content-disposition")).toBe("attachment");
    expect((await res.text()).startsWith("<?xml")).toBe(true);
  });

  it("liefert unbekannte Endungen als octet-stream zum Download", async () => {
    const res = await get(["items", TXT_NAME]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-disposition")).toBe("attachment");
  });

  it("blockiert Pfad-Traversal und versteckte Dateien", async () => {
    expect((await get(["..", "package.json"])).status).toBe(400);
    expect((await get(["items", "..", "..", "package.json"])).status).toBe(400);
    expect((await get(["items", ".htaccess"])).status).toBe(400);
    expect((await get(["items\\..\\x"])).status).toBe(400);
  });

  it("antwortet 404 für nicht vorhandene Dateien und 400 ohne Pfad", async () => {
    expect((await get(["items", "gibt-es-nicht.png"])).status).toBe(404);
    expect((await get([])).status).toBe(400);
  });
});
