import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import {
  createOrGetUser,
  createAuthCode,
  CODE_TTL_MINUTES,
  LOGIN_COOKIE,
  LOGIN_COOKIE_PATH,
  secureCookies,
} from "@/lib/auth";
import { sendAuthCode } from "@/lib/email";
import { readJsonObject } from "@/lib/request";

const HANDLE_RE = /^[a-zA-Z0-9_\-]{3,20}$/;
// Bewusst grob: ein "@" mit etwas davor und einer Domain mit Punkt dahinter.
// Die eigentliche Prüfung ist der Code, der an diese Adresse geht.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export async function POST(req: NextRequest) {
  const body = await readJsonObject(req);
  if (!body || typeof body.handle !== "string" || typeof body.email !== "string") {
    return NextResponse.json({ error: "handle und email erforderlich" }, { status: 400 });
  }

  const trimHandle = body.handle.trim();
  const trimEmail = body.email.trim().toLowerCase();

  if (!HANDLE_RE.test(trimHandle)) {
    return NextResponse.json(
      { error: "Handle: 3-20 Zeichen, nur Buchstaben, Zahlen, _ und -" },
      { status: 400 }
    );
  }
  if (trimEmail.length > MAX_EMAIL_LENGTH || !EMAIL_RE.test(trimEmail)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }

  // Existiert User mit dieser Email aber anderem Handle?
  const [existingByEmail] = await db.select().from(users).where(eq(users.email, trimEmail));
  if (existingByEmail && existingByEmail.handle !== trimHandle) {
    return NextResponse.json(
      { error: "Diese Email ist bereits mit einem anderen Handle registriert" },
      { status: 409 }
    );
  }

  const result = await createOrGetUser(trimHandle, trimEmail);

  if (result.error === "handle_taken") {
    return NextResponse.json(
      { error: "Dieses Handle ist bereits vergeben" },
      { status: 409 }
    );
  }

  if (!result.user) {
    return NextResponse.json({ error: "Fehler beim Anlegen des Benutzers" }, { status: 500 });
  }

  const { code, challenge } = await createAuthCode(result.user.id);
  await sendAuthCode(trimEmail, trimHandle, code);

  // Der Login-Vorgang wird an den Browser gebunden: Der Code ist nur mit
  // diesem Cookie einlösbar. Die user_id wird dem Client nicht mehr verraten.
  const res = NextResponse.json({
    success: true,
    message: "Code wurde an deine Email gesendet",
  });
  res.cookies.set(LOGIN_COOKIE, challenge, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: LOGIN_COOKIE_PATH,
    maxAge: CODE_TTL_MINUTES * 60,
  });
  return res;
}
