import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Session auch serverseitig beenden – nur das Cookie zu löschen ließe einen
  // kopierten Token weiter gültig.
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);

  const res = NextResponse.json({ success: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
