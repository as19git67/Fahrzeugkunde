import type { NextConfig } from "next";
import { execSync } from "node:child_process";

function readBuildNumber(): string {
  // Im CI wird BUILD_NUMBER als Docker-Build-Arg gesetzt (z.B. "42-abcdef1234...").
  if (process.env.BUILD_NUMBER) return process.env.BUILD_NUMBER;
  if (process.env.NEXT_PUBLIC_BUILD_SHA) return process.env.NEXT_PUBLIC_BUILD_SHA;
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

const BUILD_SHA = readBuildNumber();
const BUILD_TIME = new Date().toISOString();

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_BUILD_SHA: BUILD_SHA,
    NEXT_PUBLIC_BUILD_TIME: BUILD_TIME,
  },
  // src/db/schema-sql.ts liest src/db/schema.sql zur Laufzeit via fs.readFileSync.
  // Da die Datei nur dynamisch referenziert wird, muss sie explizit ins Standalone-
  // Trace aufgenommen werden, damit sie im Docker-Runner unter cwd/src/db/schema.sql
  // verfuegbar ist.
  outputFileTracingIncludes: {
    "/*": ["src/db/schema.sql"],
  },
  images: {
    // Lokale Uploads erlauben. /uploads/** kommt aus dem public-Ordner
    // (Seed-Bilder), /api/uploads/** wird vom Route Handler ausgeliefert.
    remotePatterns: [],
    localPatterns: [
      { pathname: "/uploads/**" },
      { pathname: "/api/uploads/**" },
    ],
    // SVG-Dateien (Seed-Bilder und Fahrzeugansichten) durch die Image-Optimierung zulassen.
    // Ohne diese Option liefert Next.js bei /_next/image?url=...svg einen Fehler und das
    // <Image>-Tag zeigt einen gebrochenen Link (z.B. bei "Was ist das?").
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
