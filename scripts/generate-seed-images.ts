/**
 * Generiert für jedes Item in HLF20_ITEMS ein SVG im Comic/Sketch-Stil.
 *
 *   public/uploads/items/seed/<slug>.svg
 *
 * Keine sichtbaren Texte im SVG — nur aria-label für A11y.
 * Icons werden per Keyword-Matching auf den Namen ausgewählt,
 * Fallback ist eine generische Werkzeug-Silhouette.
 *
 *   npx tsx scripts/generate-seed-images.ts
 */

import fs from "node:fs";
import path from "node:path";
import { HLF20_ITEMS, itemSlug, type ItemSeed } from "../src/db/seed-hlf20";

const OUT_DIR = path.join(process.cwd(), "public", "uploads", "items", "seed");

// -- Style-Konstanten --------------------------------------------------------

const INK = "#1a1a1a";
const PAPER_A = "#f7f1e1";
const PAPER_B = "#e8dfc3";

const CATEGORY_ACCENT: Record<string, string> = {
  atemschutz: "#3aa0ff",
  elektro: "#f5c330",
  th: "#f25c4a",
  wasser: "#2e8bff",
  armaturen: "#6aa0ff",
  loeschmittel: "#d83a2a",
  werkzeug: "#b47a30",
  bergung: "#c26a2d",
  gefahrgut: "#f2b52f",
  messtechnik: "#9a5bd0",
  pumpe: "#4a6fbf",
  absicherung: "#f0a030",
  belueftung: "#50b8d8",
  sanitaet: "#e05a85",
  funk: "#7a5ad0",
  leitern: "#78a82f",
};

const FALLBACK_ACCENT = "#b47a30";

// -- Icon-Dispatch -----------------------------------------------------------

export type IconCtx = {
  accent: string;
  ink: string;
  /** cx, cy of drawing area */
  cx: number;
  cy: number;
};

export type IconFn = (ctx: IconCtx) => string;

/**
 * Registry: erste passende Regex gewinnt.
 * Füllt sich in späteren Blöcken.
 */
const ICON_REGISTRY: Array<[RegExp, IconFn]> = [];

/** Generische Werkzeug-Silhouette als Fallback. */
const iconFallback: IconFn = ({ accent, ink, cx, cy }) => {
  // Hammer/Schraubenschlüssel-Kombi
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" fill="${accent}">
      <!-- Hammerkopf -->
      <rect x="${x - 70}" y="${y - 30}" width="60" height="28" rx="4" />
      <rect x="${x - 82}" y="${y - 26}" width="16" height="20" rx="3" fill="${ink}" />
      <!-- Stiel -->
      <rect x="${x - 14}" y="${y - 8}" width="90" height="14" rx="6" fill="#c9a068" />
      <!-- Griff-Wicklung -->
      <line x1="${x + 30}" y1="${y - 6}" x2="${x + 30}" y2="${y + 4}" />
      <line x1="${x + 42}" y1="${y - 6}" x2="${x + 42}" y2="${y + 4}" />
      <line x1="${x + 54}" y1="${y - 6}" x2="${x + 54}" y2="${y + 4}" />
    </g>
  `;
};

function pickIcon(name: string): IconFn {
  const n = name.toLowerCase();
  for (const [re, fn] of ICON_REGISTRY) {
    if (re.test(n)) return fn;
  }
  return iconFallback;
}

function accentFor(category: string): string {
  return CATEGORY_ACCENT[category] ?? FALLBACK_ACCENT;
}

// -- SVG-Wrapper -------------------------------------------------------------

/**
 * Umschließt einen Icon-Body mit Paper-Hintergrund, Vignette, Doppel-Rahmen,
 * Sketch-Filter (feTurbulence + feDisplacementMap) und pencil-shading Linien.
 */
function renderSvg(item: ItemSeed, iconBody: string): string {
  const label = `${item.article} ${item.name}`.replace(/"/g, "&quot;");
  const accent = accentFor(item.category);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" role="img" aria-label="${label}">
  <defs>
    <radialGradient id="paper" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${PAPER_A}" />
      <stop offset="100%" stop-color="${PAPER_B}" />
    </radialGradient>
    <filter id="sketch" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="${hashSeed(item.name)}" />
      <feDisplacementMap in="SourceGraphic" scale="1.8" />
    </filter>
    <filter id="sketchLight" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="1" seed="${hashSeed(item.name) + 3}" />
      <feDisplacementMap in="SourceGraphic" scale="1.1" />
    </filter>
  </defs>

  <!-- Papier-Hintergrund -->
  <rect width="320" height="220" fill="url(#paper)" />

  <!-- Doppel-Rahmen, leicht verzittert -->
  <g fill="none" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round" filter="url(#sketchLight)">
    <rect x="10" y="10" width="300" height="200" stroke-width="2.4" rx="4" />
    <rect x="15" y="15" width="290" height="190" stroke-width="1.2" rx="3" />
  </g>

  <!-- Pencil-Shading neben der Haupt-Silhouette -->
  <g stroke="${INK}" stroke-width="1" opacity="0.18" filter="url(#sketchLight)">
    <line x1="38" y1="180" x2="78" y2="180" />
    <line x1="38" y1="186" x2="88" y2="186" />
    <line x1="38" y1="192" x2="70" y2="192" />
    <line x1="244" y1="46" x2="282" y2="46" />
    <line x1="244" y1="52" x2="276" y2="52" />
  </g>

  <!-- Haupt-Icon mit Sketch-Filter -->
  <g filter="url(#sketch)">
    ${iconBody}
  </g>
</svg>
`;
}

/** Kleiner stabiler Seed aus dem Namen, damit Icons reproduzierbar aussehen. */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 1000;
}

// -- Main --------------------------------------------------------------------

function generate(): void {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const seen = new Set<string>();
  let count = 0;

  for (const item of HLF20_ITEMS) {
    const slug = itemSlug(item.name);
    if (seen.has(slug)) {
      console.warn(`! duplicate slug '${slug}' for '${item.name}' — overwriting`);
    }
    seen.add(slug);

    const icon = pickIcon(item.name);
    const body = icon({
      accent: accentFor(item.category),
      ink: INK,
      cx: 160,
      cy: 110,
    });
    const svg = renderSvg(item, body);

    fs.writeFileSync(path.join(OUT_DIR, `${slug}.svg`), svg, "utf8");
    count++;
  }

  console.log(`Wrote ${count} SVG(s) to ${path.relative(process.cwd(), OUT_DIR)}`);
}

// In späteren Blöcken werden hier Icon-Funktionen registriert.
// (leer gelassen — Block 1 nutzt nur iconFallback)

generate();
