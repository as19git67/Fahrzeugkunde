import { db, users, authCodes, sessions } from "@/db";
import { eq, and, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import crypto from "crypto";

export const SESSION_COOKIE = "fwk_session";

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

  const [user] = await db.insert(users).values({ handle, email }).returning();
  return { user, isNew: true };
}

export async function createAuthCode(userId: number): Promise<string> {
  // Alte Codes löschen
  await db.delete(authCodes).where(eq(authCodes.userId, userId));

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min

  await db.insert(authCodes).values({ userId, code, expiresAt });
  return code;
}

export async function verifyCode(userId: number, code: string): Promise<boolean> {
  const now = new Date().toISOString();
  const [record] = await db
    .select()
    .from(authCodes)
    .where(
      and(
        eq(authCodes.userId, userId),
        eq(authCodes.code, code),
        eq(authCodes.used, false),
        gt(authCodes.expiresAt, now)
      )
    )
    .limit(1);

  if (!record) return false;

  await db
    .update(authCodes)
    .set({ used: true })
    .where(eq(authCodes.id, record.id));

  // User als verifiziert markieren
  await db.update(users).set({ verified: true }).where(eq(users.id, userId));

  return true;
}

export async function createSession(userId: number): Promise<string> {
  const token = generateToken();
  await db.insert(sessions).values({ userId, token });
  return token;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
  if (!session) return null;

  const [user] = await db.select().from(users).where(eq(users.id, session.userId));
  return user ?? null;
}
