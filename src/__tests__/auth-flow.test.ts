/**
 * End-to-End-Test des Login-Flows über die echten Routen:
 * Login → Cookie mit challenge → Code einlösen → Session. Prüft, dass der
 * Code an das Cookie gebunden ist, Fehlversuche gezählt werden und der Code
 * nach MAX_CODE_ATTEMPTS gesperrt wird.
 *
 * Der Mail-Versand ist gemockt; der Code wird aus dem Mock-Aufruf gelesen.
 */
import { it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, closeDb, describeDb as describe } from "./db-helper";
import { authCodes, sessions, users } from "@/db/schema";

process.env.DATABASE_URL =
  process.env.POSTGRES_TEST_CONNECTION_STRING || process.env.DATABASE_URL;

const mail = vi.hoisted(() => ({ lastCode: null as string | null }));
vi.mock("@/lib/email", () => ({
  sendAuthCode: vi.fn(async (_email: string, _handle: string, code: string) => {
    mail.lastCode = code;
  }),
}));

const testDb = getTestDb();
let auth: typeof import("@/lib/auth");
let login: typeof import("@/app/api/auth/login/route");
let verify: typeof import("@/app/api/auth/verify/route");
let logout: typeof import("@/app/api/auth/logout/route");

function jsonReq(url: string, body: unknown, cookie?: string) {
  return new NextRequest(`http://localhost${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function doLogin(handle = "Max", email = "max@test.de") {
  const res = await login.POST(jsonReq("/api/auth/login", { handle, email }));
  const body = await res.json();
  const challenge = res.cookies.get(auth.LOGIN_COOKIE)?.value ?? null;
  return { status: res.status, body, challenge, code: mail.lastCode, res };
}

async function doVerify(code: string, challenge: string | null) {
  const res = await verify.POST(
    jsonReq("/api/auth/verify", { code }, challenge ? `${auth.LOGIN_COOKIE}=${challenge}` : undefined)
  );
  return { status: res.status, body: await res.json(), res };
}

describe("Login-Flow: /api/auth/login → /api/auth/verify → /api/auth/logout", () => {
  beforeAll(async () => {
    auth = await import("@/lib/auth");
    login = await import("@/app/api/auth/login/route");
    verify = await import("@/app/api/auth/verify/route");
    logout = await import("@/app/api/auth/logout/route");
  });

  beforeEach(async () => {
    mail.lastCode = null;
    await cleanDb();
  });

  afterAll(async () => {
    await cleanDb();
    await closeDb();
  });

  it("generateCode: immer 6 Ziffern, auch mit führenden Nullen", () => {
    for (let i = 0; i < 500; i++) expect(auth.generateCode()).toMatch(/^\d{6}$/);
  });

  it("login: setzt ein httpOnly-Login-Cookie und verrät keine userId", async () => {
    const { status, body, challenge, code, res } = await doLogin();
    expect(status).toBe(200);
    expect(body).not.toHaveProperty("userId");
    expect(challenge).toMatch(/^[0-9a-f]{64}$/);
    expect(code).toMatch(/^\d{6}$/);
    expect(res.cookies.get(auth.LOGIN_COOKIE)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: auth.LOGIN_COOKIE_PATH,
      maxAge: auth.CODE_TTL_MINUTES * 60,
    });
    // Der Code steht mit der challenge in der DB, attempts startet bei 0
    const [row] = await testDb.select().from(authCodes);
    expect(row.challenge).toBe(challenge);
    expect(row.code).toBe(code);
    expect(row.attempts).toBe(0);
  });

  it("login: validiert Eingaben (400) statt sie durchzureichen", async () => {
    expect((await login.POST(jsonReq("/api/auth/login", "{kaputt"))).status).toBe(400);
    expect((await login.POST(jsonReq("/api/auth/login", { handle: 42, email: "a@b.de" }))).status).toBe(400);
    expect((await login.POST(jsonReq("/api/auth/login", { handle: "Max", email: "keine-mail" }))).status).toBe(400);
    expect((await login.POST(jsonReq("/api/auth/login", { handle: "x", email: "a@b.de" }))).status).toBe(400);
    expect(await testDb.select().from(users)).toHaveLength(0);
  });

  it("verify: richtiger Code liefert Session-Cookie und räumt das Login-Cookie ab", async () => {
    const { challenge, code } = await doLogin();
    const { status, res } = await doVerify(code!, challenge);
    expect(status).toBe(200);

    const session = res.cookies.get(auth.SESSION_COOKIE)?.value;
    expect(session).toMatch(/^[0-9a-f]{64}$/);
    expect(res.cookies.get(auth.SESSION_COOKIE)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    // Login-Cookie wird abgeräumt
    expect(res.cookies.get(auth.LOGIN_COOKIE)).toMatchObject({ value: "", maxAge: 0 });

    const [row] = await testDb.select().from(sessions).where(eq(sessions.token, session!));
    expect(row).toBeTruthy();
    const [u] = await testDb.select().from(users).where(eq(users.id, row.userId));
    expect(u.handle).toBe("Max");
    expect(u.verified).toBe(true);

    // Replay desselben Codes schlägt fehl
    expect((await doVerify(code!, challenge)).status).toBe(401);
  });

  it("verify: ohne Cookie, mit fremder challenge oder falschem Format keine Chance", async () => {
    const { code } = await doLogin();
    expect((await doVerify(code!, null)).status).toBe(400);
    expect((await doVerify(code!, "0".repeat(64))).status).toBe(401);
    const { challenge } = await doLogin();
    expect((await doVerify("12ab56", challenge)).status).toBe(400);
    expect((await doVerify("1234567", challenge)).status).toBe(400);
  });

  it("verify: zählt Fehlversuche und sperrt den Code nach MAX_CODE_ATTEMPTS", async () => {
    const { challenge, code } = await doLogin();
    const wrong = code === "000000" ? "000001" : "000000";

    for (let i = 1; i < auth.MAX_CODE_ATTEMPTS; i++) {
      const { status, body } = await doVerify(wrong, challenge);
      expect(status).toBe(401);
      expect(body.error).toMatch(/Ungültiger Code/);
      const [row] = await testDb.select().from(authCodes);
      expect(row.attempts).toBe(i);
    }

    // Letzter Versuch: gesperrt, Code gelöscht, Login-Cookie wird abgeräumt
    const locked = await doVerify(wrong, challenge);
    expect(locked.status).toBe(429);
    expect(locked.body.error).toMatch(/Zu viele Fehlversuche/);
    expect(locked.res.cookies.get(auth.LOGIN_COOKIE)).toMatchObject({ value: "", maxAge: 0 });
    expect(await testDb.select().from(authCodes)).toHaveLength(0);

    // Der eigentlich richtige Code hilft jetzt nicht mehr
    expect((await doVerify(code!, challenge)).status).toBe(401);
    expect(await testDb.select().from(sessions)).toHaveLength(0);

    // Neuer Login-Vorgang funktioniert wieder
    const fresh = await doLogin();
    expect((await doVerify(fresh.code!, fresh.challenge)).status).toBe(200);
  });

  it("verify: abgelaufene Codes werden abgelehnt und entfernt", async () => {
    const { challenge } = await doLogin();
    await testDb
      .update(authCodes)
      .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
      .where(eq(authCodes.challenge, challenge!));
    const { status, body } = await doVerify(mail.lastCode!, challenge);
    expect(status).toBe(401);
    expect(body.error).toMatch(/abgelaufen/);
    expect(await testDb.select().from(authCodes)).toHaveLength(0);
  });

  it("login: ein neuer Login-Vorgang macht den alten Code ungültig", async () => {
    const first = await doLogin();
    const second = await doLogin();
    expect((await doVerify(first.code!, first.challenge)).status).toBe(401);
    expect((await doVerify(second.code!, second.challenge)).status).toBe(200);
  });

  it("logout: löscht die Session serverseitig", async () => {
    const { challenge, code } = await doLogin();
    const { res } = await doVerify(code!, challenge);
    const token = res.cookies.get(auth.SESSION_COOKIE)!.value;
    expect(await testDb.select().from(sessions)).toHaveLength(1);

    const out = await logout.POST(
      new NextRequest("http://localhost/api/auth/logout", {
        method: "POST",
        headers: { Cookie: `${auth.SESSION_COOKIE}=${token}` },
      })
    );
    expect(out.status).toBe(200);
    expect(await testDb.select().from(sessions)).toHaveLength(0);
  });
});
