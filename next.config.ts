import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App privée 100% dynamique (données perso) : pas de Cache Components.
  experimental: {
    // Une page déjà vue il y a moins de 30 s se rouvre instantanément (aller-retour entre onglets).
    // Sans risque de données périmées après une modif : chaque server action vide ce cache (revalidatePath).
    staleTimes: { dynamic: 30 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
