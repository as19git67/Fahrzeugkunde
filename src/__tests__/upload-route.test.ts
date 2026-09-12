/**
 * Tests für POST /api/upload: Der Dateityp muss aus dem Inhalt kommen, nicht
 * aus Dateiname oder MIME-Typ, und nur bekannte Zielordner sind erlaubt.
 *
 * Die Session wird gemockt (kein DB-Zugriff nötig). Geschriebene Dateien werden
 * nach jedem Test wieder entfernt.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => ({ id: 1, handle: "tester", email: "t@example.org", role: "user" })),
}));

import { getSessionUser } from "@/lib/auth";
import { POST } from "@/app/api/upload/route";
import { MAX_UPLOAD_BYTES } from "@/lib/image-type";
import { JPG_BYTES, PNG_BYTES, SVG_CLEAN } from "./image-type.test";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const written: string[] = [];

function makeRequest(
  content: Buffer,
  opts: { name: string; type: string; folder?: string }
): NextRequest {
  const fd = new FormData();
  fd.append("file", new File([new Uint8Array(content)], opts.name, { type: opts.type }));
  if (opts.folder !== undefined) fd.append("folder", opts.folder);
  return new NextRequest("http://localhost/api/upload", { method: "POST", body: fd });
}

async function upload(content: Buffer, opts: { name: string; type: string; folder?: string }) {
  const res = await POST(makeRequest(content, opts));
  const body = (await res.json()) as { path?: string; error?: string };
  if (body.path) written.push(path.join(UPLOAD_DIR, body.path.replace(/^\/api\/uploads\//, "")));
  return { status: res.status, body };
}

afterEach(async () => {
  await Promise.all(written.splice(0).map((p) => fs.unlink(p).catch(() => {})));
});

describe("POST /api/upload", () => {
  it("verlangt eine Session", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);
    const { status } = await upload(PNG_BYTES, { name: "a.png", type: "image/png" });
    expect(status).toBe(401);
  });

  it("speichert ein PNG mit Endung aus dem Inhalt – auch wenn Name und MIME lügen", async () => {
    const { status, body } = await upload(PNG_BYTES, { name: "evil.svg", type: "image/svg+xml" });
    expect(status).toBe(200);
    expect(body.path).toMatch(/^\/api\/uploads\/items\/\d+_[a-z0-9]+\.png$/);
    const stat = await fs.stat(written[0]);
    expect(stat.size).toBe(PNG_BYTES.length);
  });

  it("akzeptiert JPEG ohne bzw. mit abweichendem MIME-Typ (Drag&Drop)", async () => {
    const a = await upload(JPG_BYTES, { name: "foto.jpeg", type: "" });
    expect(a.status).toBe(200);
    expect(a.body.path).toMatch(/\.jpg$/);
    const b = await upload(JPG_BYTES, { name: "foto.JPG", type: "image/jpg" });
    expect(b.status).toBe(200);
  });

  it("lehnt SVG ab, selbst wenn es als PNG deklariert ist", async () => {
    const { status, body } = await upload(SVG_CLEAN, { name: "evil.svg", type: "image/png" });
    expect(status).toBe(400);
    expect(body.error).toMatch(/Nur JPG, PNG, WebP, GIF/);
  });

  it("lehnt HTML mit Bild-Endung ab", async () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    const { status } = await upload(html, { name: "bild.jpg", type: "image/jpeg" });
    expect(status).toBe(400);
  });

  it("lehnt unbekannte Zielordner ab (keine neuen Unterordner, keine Seed-Ordner)", async () => {
    for (const folder of ["seed", "items/seed", "../etc", "views2"]) {
      const { status, body } = await upload(PNG_BYTES, { name: "a.png", type: "image/png", folder });
      expect(status, folder).toBe(400);
      expect(body.error).toMatch(/Zielordner/);
    }
  });

  it("schreibt in erlaubte Ordner", async () => {
    const { status, body } = await upload(PNG_BYTES, { name: "a.png", type: "image/png", folder: "views" });
    expect(status).toBe(200);
    expect(body.path).toMatch(/^\/api\/uploads\/views\//);
  });

  it("lehnt zu große Dateien ab (413)", async () => {
    const big = Buffer.concat([PNG_BYTES, Buffer.alloc(MAX_UPLOAD_BYTES)]);
    const { status } = await upload(big, { name: "big.png", type: "image/png" });
    expect(status).toBe(413);
  });

  it("antwortet 400 ohne Datei", async () => {
    const fd = new FormData();
    const res = await POST(new NextRequest("http://localhost/api/upload", { method: "POST", body: fd }));
    expect(res.status).toBe(400);
  });
});
