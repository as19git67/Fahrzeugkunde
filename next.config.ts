import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Lokale Uploads erlauben
    remotePatterns: [],
    localPatterns: [{ pathname: "/uploads/**" }],
    // SVG-Dateien (Seed-Bilder und Fahrzeugansichten) durch die Image-Optimierung zulassen.
    // Ohne diese Option liefert Next.js bei /_next/image?url=...svg einen Fehler und das
    // <Image>-Tag zeigt einen gebrochenen Link (z.B. bei "Was ist das?").
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
