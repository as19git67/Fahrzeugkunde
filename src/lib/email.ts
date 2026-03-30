import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "localhost",
  port: parseInt(process.env.SMTP_PORT || "25"),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

export async function sendAuthCode(email: string, handle: string, code: string) {
  if (process.env.NODE_ENV === "development") {
    console.log(`\n📧 Auth-Code für ${handle} (${email}): ${code}\n`);
    return;
  }

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
