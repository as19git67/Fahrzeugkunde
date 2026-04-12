import { NextRequest, NextResponse } from "next/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { createOrGetUser, createAuthCode } from "@/lib/auth";
import { sendAuthCode } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { handle, email } = await req.json();

  if (!handle || !email) {
    return NextResponse.json({ error: "handle und email erforderlich" }, { status: 400 });
  }

  const trimHandle = handle.trim();
  const trimEmail = email.trim().toLowerCase();

  if (!/^[a-zA-Z0-9_\-]{3,20}$/.test(trimHandle)) {
    return NextResponse.json(
      { error: "Handle: 3-20 Zeichen, nur Buchstaben, Zahlen, _ und -" },
      { status: 400 }
    );
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

  const code = await createAuthCode(result.user.id);
  await sendAuthCode(trimEmail, trimHandle, code);

  return NextResponse.json({
    success: true,
    userId: result.user.id,
    message: "Code wurde an deine Email gesendet",
  });
}
