import { NextRequest, NextResponse } from "next/server";
import {
  verifyCode,
  createSession,
  LOGIN_COOKIE,
  LOGIN_COOKIE_PATH,
  SESSION_COOKIE,
  secureCookies,
} from "@/lib/auth";
import { readJsonObject } from "@/lib/request";

const ERROR_BY_REASON = {
  invalid: { status: 401, error: "Ungültiger Code" },
  expired: { status: 401, error: "Code abgelaufen – bitte neuen Code anfordern" },
  locked: { status: 429, error: "Zu viele Fehlversuche – bitte neuen Code anfordern" },
} as const;

function clearLoginCookie(res: NextResponse) {
  res.cookies.set(LOGIN_COOKIE, "", { path: LOGIN_COOKIE_PATH, maxAge: 0 });
}

export async function POST(req: NextRequest) {
  // Der Login-Vorgang kommt aus dem Cookie, nicht aus dem Body: Der Client
  // kann so keinen fremden Vorgang (fremde user_id) angreifen.
  const challenge = req.cookies.get(LOGIN_COOKIE)?.value;
  if (!challenge) {
    return NextResponse.json(
      { error: "Kein Login-Vorgang gefunden – bitte Code neu anfordern" },
      { status: 400 }
    );
  }

  const body = await readJsonObject(req);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Code muss aus 6 Ziffern bestehen" }, { status: 400 });
  }

  const result = await verifyCode(challenge, code);
  if (!result.ok) {
    const { status, error } = ERROR_BY_REASON[result.reason];
    const res = NextResponse.json({ error }, { status });
    // Der Vorgang ist beendet – Cookie aufräumen, damit der Client neu startet
    if (result.reason !== "invalid") clearLoginCookie(res);
    return res;
  }

  const token = await createSession(result.userId);

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookies(),
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 10, // 10 Jahre
  });
  clearLoginCookie(res);
  return res;
}
