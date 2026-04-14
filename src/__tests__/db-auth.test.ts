import { it, expect, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, closeDb, describeDb as describe } from "./db-helper";
import { users, authCodes, sessions } from "@/db/schema";
import { createOrGetUser, isAdmin } from "@/lib/auth";

const db = getTestDb();

beforeEach(async () => {
  await cleanDb();
});

afterAll(async () => {
  await cleanDb();
  await closeDb();
});

describe("users", () => {
  it("can create a user with handle and email", async () => {
    const [user] = await db
      .insert(users)
      .values({ handle: "FireMax", email: "max@feuerwehr.de" })
      .returning();

    expect(user.id).toBeGreaterThan(0);
    expect(user.handle).toBe("FireMax");
    expect(user.email).toBe("max@feuerwehr.de");
    expect(user.verified).toBe(false);
  });

  it("enforces unique handles", async () => {
    await db.insert(users).values({ handle: "FireMax", email: "max1@test.de" });

    await expect(
      db.insert(users).values({ handle: "FireMax", email: "max2@test.de" })
    ).rejects.toThrow();
  });

  it("enforces unique emails", async () => {
    await db.insert(users).values({ handle: "User1", email: "same@test.de" });

    await expect(
      db.insert(users).values({ handle: "User2", email: "same@test.de" })
    ).rejects.toThrow();
  });

  it("defaults role to 'user' for a freshly inserted row", async () => {
    const [user] = await db
      .insert(users)
      .values({ handle: "PlainUser", email: "plain@test.de" })
      .returning();
    expect(user.role).toBe("user");
    expect(isAdmin(user)).toBe(false);
  });
});

describe("first-user admin promotion", () => {
  it("promotes the very first user to admin", async () => {
    const { user, isNew } = await createOrGetUser("FirstUser", "first@test.de");
    expect(isNew).toBe(true);
    expect(user?.role).toBe("admin");
    expect(isAdmin(user)).toBe(true);
  });

  it("creates subsequent users as plain 'user'", async () => {
    await createOrGetUser("FirstUser", "first@test.de");
    const { user, isNew } = await createOrGetUser("SecondUser", "second@test.de");
    expect(isNew).toBe(true);
    expect(user?.role).toBe("user");
    expect(isAdmin(user)).toBe(false);
  });

  it("does not demote an existing admin when looked up again", async () => {
    await createOrGetUser("FirstUser", "first@test.de");
    const { user, isNew } = await createOrGetUser("FirstUser", "first@test.de");
    expect(isNew).toBe(false);
    expect(user?.role).toBe("admin");
  });
});

describe("auth codes", () => {
  it("can create and retrieve an auth code", async () => {
    const [user] = await db
      .insert(users)
      .values({ handle: "FireMax", email: "max@test.de" })
      .returning();

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const [code] = await db
      .insert(authCodes)
      .values({ userId: user.id, code: "123456", expiresAt })
      .returning();

    expect(code.code).toBe("123456");
    expect(code.used).toBe(false);
  });

  it("cascades delete when user is deleted", async () => {
    const [user] = await db
      .insert(users)
      .values({ handle: "FireMax", email: "max@test.de" })
      .returning();

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    await db.insert(authCodes).values({ userId: user.id, code: "123456", expiresAt });

    await db.delete(users).where(eq(users.id, user.id));

    const codes = await db.select().from(authCodes);
    expect(codes).toHaveLength(0);
  });

  it("can mark code as used", async () => {
    const [user] = await db
      .insert(users)
      .values({ handle: "FireMax", email: "max@test.de" })
      .returning();

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const [code] = await db
      .insert(authCodes)
      .values({ userId: user.id, code: "123456", expiresAt })
      .returning();

    const [updated] = await db
      .update(authCodes)
      .set({ used: true })
      .where(eq(authCodes.id, code.id))
      .returning();

    expect(updated.used).toBe(true);
  });
});

describe("sessions", () => {
  it("can create a session with token", async () => {
    const [user] = await db
      .insert(users)
      .values({ handle: "FireMax", email: "max@test.de" })
      .returning();

    const [session] = await db
      .insert(sessions)
      .values({ userId: user.id, token: "abc123def456" })
      .returning();

    expect(session.token).toBe("abc123def456");
    expect(session.userId).toBe(user.id);
  });

  it("enforces unique tokens", async () => {
    const [user] = await db
      .insert(users)
      .values({ handle: "FireMax", email: "max@test.de" })
      .returning();

    await db.insert(sessions).values({ userId: user.id, token: "same-token" });

    await expect(
      db.insert(sessions).values({ userId: user.id, token: "same-token" })
    ).rejects.toThrow();
  });

  it("cascades delete when user is deleted", async () => {
    const [user] = await db
      .insert(users)
      .values({ handle: "FireMax", email: "max@test.de" })
      .returning();

    await db.insert(sessions).values({ userId: user.id, token: "token-1" });
    await db.insert(sessions).values({ userId: user.id, token: "token-2" });

    await db.delete(users).where(eq(users.id, user.id));

    const remaining = await db.select().from(sessions);
    expect(remaining).toHaveLength(0);
  });
});

describe("highscores", () => {
  it("can store a highscore with user", async () => {
    const [user] = await db
      .insert(users)
      .values({ handle: "FireMax", email: "max@test.de" })
      .returning();

    const { highscores } = await import("@/db/schema");
    const [entry] = await db
      .insert(highscores)
      .values({
        userId: user.id,
        handle: "FireMax",
        score: 1500,
        mode: "time_attack",
        correctAnswers: 8,
        totalAnswers: 10,
        durationSeconds: 60,
      })
      .returning();

    expect(entry.score).toBe(1500);
    expect(entry.mode).toBe("time_attack");
    expect(entry.handle).toBe("FireMax");
  });

  it("can store anonymous highscore (no user)", async () => {
    const { highscores } = await import("@/db/schema");
    const [entry] = await db
      .insert(highscores)
      .values({
        handle: "Anonym",
        score: 500,
        mode: "speed_run",
        correctAnswers: 20,
        totalAnswers: 20,
        durationSeconds: 120,
      })
      .returning();

    expect(entry.userId).toBeNull();
    expect(entry.handle).toBe("Anonym");
  });
});
