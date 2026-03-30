import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "localhost",
    port: parseInt(process.env.SMTP_PORT || "25"),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export async function sendAuthCode(email: string, handle: string, code: string) {
  const isDev = process.env.NODE_ENV === "development";
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const noSmtp = !smtpHost || smtpHost === "localhost" || smtpHost.trim() === "";

  // In der Entwicklung ODER wenn kein SMTP-Host konfiguriert ist: Nur Loggen
  if (isDev || noSmtp) {
    console.log(`\n📧 Auth-Code für ${handle} (${email}): ${code}`);
    if (noSmtp && !isDev) {
      console.warn("⚠️ SMTP_HOST ist nicht konfiguriert oder steht auf 'localhost'. E-Mail wird nur geloggt.\n");
    } else {
      console.log("");
    }
    return;
  }

  // Warnen, falls SMTP konfiguriert aber Credentials fehlen
  if (!smtpUser || !smtpPass) {
    console.error(`❌ SMTP Fehler: Credentials fehlen (User: ${!!smtpUser}, Pass: ${!!smtpPass})`);
    console.log(`📧 Auth-Code (Fallback): ${code}`);
    return;
  }

  const transporter = getTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM || "noreply@fahrzeugkunde.local",
    to: email,
    subject: "Dein Login-Code – Fahrzeugkunde",
    text: `Hallo ${handle},\n\ndein Login-Code lautet: ${code}\n\nGültig für 15 Minuten.\n`,
    html: `
      <div style="font-family:sans-serif;max-width:400px">
        <h2 style="color:#e63946">🚒 Fahrzeugkunde Login</h2>
        <p>Hallo <strong>${handle}</strong>,</p>
        <p>dein Login-Code lautet:</p>
        <div style="font-size:2.5rem;font-weight:bold;letter-spacing:0.3em;color:#e63946;padding:16px 0">
          ${code}
        </div>
        <p style="color:#666;font-size:0.85em">Gültig für 15 Minuten.</p>
      </div>
    `,
  });
}
