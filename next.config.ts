import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Lokale Uploads erlauben
    remotePatterns: [],
    localPatterns: [{ pathname: "/uploads/**" }],
  },
  // Für better-sqlite3 (native Node module)
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
