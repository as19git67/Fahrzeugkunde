import { db, users, authCodes, sessions } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

export const SESSION_COOKIE = "fwk_session";

/** Bindet den laufenden Login-Vorgang (challenge) an den Browser. */
export const LOGIN_COOKIE = "fwk_login";
export const LOGIN_COOKIE_PATH = "/api/auth";

export const CODE_TTL_MINUTES = 15;
/** Fehlversuche pro Code; danach wird der Code gelöscht (neuen anfordern). */
export const MAX_CODE_ATTEMPTS = 5;

/** Cookies nur in Produktion auf https beschränken – lokal läuft die App über http. */
export function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

export type UserRole = "admin" | "user";

/** Minimal-Typ des Session-Users wie er aus der DB gelesen wird. */
export type SessionUser = {
  id: number;
  handle: string;
  email: string;
  verified: boolean | null;
  role: string;
  createdAt: string | null;
};

export function isAdmin(user: { role?: string | null } | null | undefined): boolean {
  return !!user && user.role === "admin";
}

/** 6-stelliger Code aus einer kryptographisch sicheren Quelle (mit führenden Nullen). */
export function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createOrGetUser(handle: string, email: string) {
  // Existiert User mit dieser Email?
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return { user: existing, isNew: false };

  // Handle schon vergeben?
  const [handleTaken] = await db.select().from(users).where(eq(users.handle, handle));
  if (handleTaken) return { user: null, isNew: false, error: "handle_taken" };

  // Der erste jemals registrierte Benutzer wird automatisch zum Administrator.
  // So bekommt die frisch aufgesetzte Installation ohne weiteres Zutun genau
  // einen Admin, der DB-Reset und Fahrzeug-Import/-Export auslösen darf.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const role: UserRole = count === 0 ? "admin" : "user";

  const [user] = await db.insert(users).values({ handle, email, role }).returning();
  return { user, isNew: true };
}

/**
 * Legt einen neuen Login-Code an. Die zurückgegebene `challenge` wandert als
 * httpOnly-Cookie zum Browser; nur wer sie besitzt, kann den Code einlösen.
 */
export async function createAuthCode(
  userId: number
): Promise<{ code: string; challenge: string }> {
  // Alte Codes löschen – pro Nutzer ist immer nur ein Login-Vorgang offen
  await db.delete(authCodes).where(eq(authCodes.userId, userId));

  const code = generateCode();
  const challenge = generateToken();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  await db.insert(authCodes).values({ userId, code, challenge, expiresAt });
  return { code, challenge };
}

export type VerifyResult =
  | { ok: true; userId: number }
  | { ok: false; reason: "invalid" | "expired" | "locked" };

/**
 * Löst einen Login-Code ein. Statt einer vom Client gewählten user_id
 * identifiziert die `challenge` aus dem Login-Cookie den Vorgang – ein
 * Angreifer kann so keinen fremden Code durchprobieren. Fehlversuche werden
 * gezählt; ab MAX_CODE_ATTEMPTS wird der Code gelöscht (Brute-Force auf
 * 6 Ziffern ist damit ausgeschlossen).
 */
export async function verifyCode(challenge: string, code: string): Promise<VerifyResult> {
  const [record] = await db
    .select()
    .from(authCodes)
    .where(and(eq(authCodes.challenge, challenge), eq(authCodes.used, false)))
    .limit(1);
  if (!record) return { ok: false, reason: "invalid" };

  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    await db.delete(authCodes).where(eq(authCodes.id, record.id));
    return { ok: false, reason: "expired" };
  }

  const expected = Buffer.from(record.code);
  const given = Buffer.from(code);
  const matches = expected.length === given.length && crypto.timingSafeEqual(expected, given);
  if (!matches) {
    // Atomar hochzählen, damit parallele Versuche nicht denselben Stand lesen
    const [updated] = await db
      .update(authCodes)
      .set({ attempts: sql`${authCodes.attempts} + 1` })
      .where(eq(authCodes.id, record.id))
      .returning({ attempts: authCodes.attempts });
    if ((updated?.attempts ?? MAX_CODE_ATTEMPTS) >= MAX_CODE_ATTEMPTS) {
      await db.delete(authCodes).where(eq(authCodes.id, record.id));
      return { ok: false, reason: "locked" };
    }
    return { ok: false, reason: "invalid" };
  }

  await db.update(authCodes).set({ used: true }).where(eq(authCodes.id, record.id));
  // User als verifiziert markieren
  await db.update(users).set({ verified: true }).where(eq(users.id, record.userId));

  return { ok: true, userId: record.userId };
}

/** Beendet eine Session serverseitig – ein gestohlener Token bleibt sonst gültig. */
export async function destroySession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  await db.insert(sessions).values({ userId, token });
  return token;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return (user as SessionUser | undefined) ?? null;
}

/**
 * Autorisierungs-Guard für alle Routen, die Inhalte verändern (Creator,
 * Upload, Admin). Laut Produktmodell bearbeiten nur Administratoren
 * Fahrzeuge; normale Nutzer spielen und tragen Highscores ein.
 *
 * Aufruf: `const { denied } = await requireAdmin(); if (denied) return denied;`
 * → 401 ohne Session, 403 mit Session aber ohne Admin-Rolle.
 */
export async function requireAdmin(): Promise<
  { user: SessionUser; denied: null } | { user: null; denied: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      denied: NextResponse.json({ error: "Nicht eingeloggt" }, { status: 401 }),
    };
  }
  if (!isAdmin(user)) {
    return {
      user: null,
      denied: NextResponse.json(
        { error: "Nur Administratoren dürfen Inhalte bearbeiten." },
        { status: 403 }
      ),
    };
  }
  return { user, denied: null };
}
