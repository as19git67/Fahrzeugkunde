import { NextRequest, NextResponse } from "next/server";
import { verifyCode, createSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { userId, code } = await req.json();

  if (!userId || !code) {
    return NextResponse.json({ error: "userId und code erforderlich" }, { status: 400 });
  }

  const valid = await verifyCode(userId, code);
  if (!valid) {
    return NextResponse.json({ error: "Ungültiger oder abgelaufener Code" }, { status: 401 });
  }

  const token = await createSession(userId);

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    // Kein maxAge → Session-Cookie; für "ewig" setzen:
    maxAge: 60 * 60 * 24 * 365 * 10, // 10 Jahre
  });
  return res;
}
