/**
 * Generiert für jedes Item aus HLF20_ITEMS eine einfache SVG-Platzhaltergrafik.
 * Aufruf: npx tsx scripts/generate-seed-images.ts
 *
 * Die SVGs sind bewusst schlicht: ein farbiger Hintergrund (Hash aus Kategorie),
 * ein großes Emoji-Symbol und der Artikel + Name. Sie dienen als Platzhalter, damit
 * das Spiel auf der Seed-Beladung sofort Bilder zeigt.
 */
import fs from "node:fs";
import path from "node:path";
import { HLF20_ITEMS, itemSlug, type ItemSeed } from "../src/db/seed-hlf20";

const OUT_DIR = path.join(process.cwd(), "public", "uploads", "items", "seed");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Emoji/Symbol pro Kategorie (nur dekorativ, XML-sicher als Unicode).
const CATEGORY_ICON: Record<string, string> = {
  atemschutz: "🫁",
  elektro: "💡",
  th: "✂️",
  hoehenrettung: "🧗",
  wasser: "💧",
  armaturen: "🚿",
  loeschmittel: "🧯",
  werkzeug: "🔧",
  bergung: "🪝",
  gefahrgut: "☣️",
  messtechnik: "📟",
  pumpe: "⚙️",
  absicherung: "🚧",
  belueftung: "🌬️",
  sanitaet: "🩺",
  funk: "📻",
  leitern: "🪜",
};

const CATEGORY_HUE: Record<string, number> = {
  atemschutz: 200,
  elektro: 45,
  th: 10,
  hoehenrettung: 140,
  wasser: 210,
  armaturen: 220,
  loeschmittel: 0,
  werkzeug: 30,
  bergung: 20,
  gefahrgut: 60,
  messtechnik: 280,
  pumpe: 230,
  absicherung: 50,
  belueftung: 190,
  sanitaet: 340,
  funk: 260,
  leitern: 100,
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function svgFor(it: ItemSeed): string {
  const hue = CATEGORY_HUE[it.category] ?? 210;
  const icon = CATEGORY_ICON[it.category] ?? "🔧";
  const bg = `hsl(${hue} 55% 28%)`;
  const bg2 = `hsl(${hue} 60% 15%)`;
  const accent = `hsl(${hue} 80% 65%)`;
  const title = `${it.article} ${it.name}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" width="320" height="220" role="img" aria-label="${xmlEscape(title)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="320" height="220" fill="url(#bg)" rx="18"/>
  <rect x="8" y="8" width="304" height="204" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="2" rx="14"/>
  <text x="160" y="110" font-family="Apple Color Emoji, Segoe UI Emoji, sans-serif" font-size="72" text-anchor="middle" dominant-baseline="middle">${icon}</text>
  <text x="160" y="170" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="13" fill="${accent}" text-anchor="middle" font-weight="600" letter-spacing="1">${xmlEscape(it.article.toUpperCase())}</text>
  <text x="160" y="195" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="16" fill="#fff" text-anchor="middle" font-weight="700">${xmlEscape(it.name)}</text>
</svg>
`;
}

let written = 0;
for (const it of HLF20_ITEMS) {
  const slug = itemSlug(it.name);
  const file = path.join(OUT_DIR, `${slug}.svg`);
  fs.writeFileSync(file, svgFor(it), "utf8");
  written++;
}

console.log(`✅ ${written} Bild-Platzhalter in ${path.relative(process.cwd(), OUT_DIR)}/ geschrieben.`);
