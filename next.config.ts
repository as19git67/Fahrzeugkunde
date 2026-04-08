import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Lokale Uploads erlauben
    remotePatterns: [],
    localPatterns: [{ pathname: "/uploads/**" }],
  },
};

export default nextConfig;
