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

// -- Icon-Primitive ----------------------------------------------------------

/** Baut ein <g>-Wrapper mit Standard-Stroke-Attributen. */
function gStroke(ink: string, width = 3.5): string {
  return `<g stroke="${ink}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" fill="none">`;
}

// -- G1 Icons ----------------------------------------------------------------

/** Hydraulische Rettungsschere: zwei gekreuzte Schneidzangen mit Korpus. */
const iconSchere: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Korpus hinten (Hydraulik) -->
      <rect x="${x + 10}" y="${y - 20}" width="70" height="40" rx="8" fill="${accent}" />
      <!-- Griffwulst -->
      <circle cx="${x + 78}" cy="${y}" r="9" fill="${accent}" />
      <!-- Zwei Scherenblätter nach links -->
      <path d="M ${x + 10} ${y - 8} L ${x - 72} ${y - 28} L ${x - 52} ${y - 4} Z" fill="#d0d0d0" />
      <path d="M ${x + 10} ${y + 8} L ${x - 72} ${y + 28} L ${x - 52} ${y + 4} Z" fill="#d0d0d0" />
      <!-- Achse -->
      <circle cx="${x + 8}" cy="${y}" r="5" fill="${ink}" />
    </g>
  `;
};

/** Rettungsspreizer: V-förmig geöffnete Arme mit Hydraulikkorpus. */
const iconSpreizer: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Korpus -->
      <rect x="${x + 8}" y="${y - 18}" width="72" height="36" rx="8" fill="${accent}" />
      <!-- Spreizarme oben/unten -->
      <path d="M ${x + 8} ${y - 6} L ${x - 70} ${y - 40} L ${x - 50} ${y - 18} L ${x + 10} ${y - 2} Z" fill="#d0d0d0" />
      <path d="M ${x + 8} ${y + 6} L ${x - 70} ${y + 40} L ${x - 50} ${y + 18} L ${x + 10} ${y + 2} Z" fill="#d0d0d0" />
      <!-- Achse -->
      <circle cx="${x + 6}" cy="${y}" r="5" fill="${ink}" />
    </g>
  `;
};

/** Rettungszylinder: Hydraulischer Zylinder mit ausgefahrenem Kolben. */
const iconZylinder: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Zylinderkörper -->
      <rect x="${x - 72}" y="${y - 14}" width="90" height="28" rx="5" fill="${accent}" />
      <!-- Kolbenstange -->
      <rect x="${x + 18}" y="${y - 7}" width="50" height="14" fill="#bcbcbc" />
      <!-- Endstück -->
      <rect x="${x + 66}" y="${y - 12}" width="10" height="24" rx="2" fill="${ink}" />
      <!-- Hydraulikanschluss -->
      <path d="M ${x - 72} ${y} L ${x - 82} ${y - 10}" stroke-width="4" />
      <circle cx="${x - 82}" cy="${y - 10}" r="4" fill="${ink}" />
      <!-- Zylinder-Rillen -->
      <line x1="${x - 56}" y1="${y - 14}" x2="${x - 56}" y2="${y + 14}" stroke-width="1.6" />
      <line x1="${x - 40}" y1="${y - 14}" x2="${x - 40}" y2="${y + 14}" stroke-width="1.6" />
    </g>
  `;
};

/** Hydraulikpumpe: Motorblock mit Griff + zwei Hydraulikanschlüssen. */
const iconHydraulikpumpe: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Motorkorpus -->
      <rect x="${x - 60}" y="${y - 30}" width="120" height="60" rx="6" fill="${accent}" />
      <!-- Deckel -->
      <rect x="${x - 50}" y="${y - 40}" width="100" height="14" rx="3" fill="${ink}" />
      <!-- Tragebügel -->
      <path d="M ${x - 30} ${y - 40} Q ${x} ${y - 60} ${x + 30} ${y - 40}" fill="none" stroke-width="4" />
      <!-- Kühlrippen -->
      <line x1="${x - 40}" y1="${y - 18}" x2="${x - 40}" y2="${y + 18}" stroke-width="1.8" />
      <line x1="${x - 28}" y1="${y - 18}" x2="${x - 28}" y2="${y + 18}" stroke-width="1.8" />
      <line x1="${x - 16}" y1="${y - 18}" x2="${x - 16}" y2="${y + 18}" stroke-width="1.8" />
      <!-- Tankfüllstand-Anzeige -->
      <circle cx="${x + 28}" cy="${y - 6}" r="8" fill="#ffffff" />
      <!-- Anschlüsse -->
      <circle cx="${x + 50}" cy="${y + 18}" r="4" fill="${ink}" />
      <circle cx="${x + 38}" cy="${y + 26}" r="4" fill="${ink}" />
    </g>
  `;
};

/** Hydraulikschlauchhaspel: Kreisförmige Trommel mit aufgewickeltem Schlauch. */
const iconHaspel: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Haspelrahmen -->
      <rect x="${x - 64}" y="${y + 28}" width="128" height="14" rx="3" fill="${ink}" />
      <path d="M ${x - 50} ${y + 28} L ${x - 56} ${y - 42}" stroke-width="4" />
      <path d="M ${x + 50} ${y + 28} L ${x + 56} ${y - 42}" stroke-width="4" />
      <!-- Trommel -->
      <circle cx="${x}" cy="${y - 10}" r="42" fill="${accent}" />
      <circle cx="${x}" cy="${y - 10}" r="30" fill="#e6d8b8" />
      <circle cx="${x}" cy="${y - 10}" r="18" fill="${accent}" />
      <!-- Kurbel -->
      <line x1="${x + 42}" y1="${y - 10}" x2="${x + 60}" y2="${y - 20}" stroke-width="4" />
      <circle cx="${x + 60}" cy="${y - 20}" r="5" fill="${ink}" />
      <!-- Schlauchende unten -->
      <path d="M ${x - 38} ${y + 22} Q ${x - 48} ${y + 40} ${x - 60} ${y + 38}" fill="none" stroke-width="4" />
    </g>
  `;
};

/** Hebekissen: Stapel flacher Kissen. */
const iconHebekissen: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Kissen 3 (unten groß) -->
      <rect x="${x - 70}" y="${y + 14}" width="140" height="26" rx="12" fill="${accent}" />
      <!-- Kissen 2 (mitte) -->
      <rect x="${x - 58}" y="${y - 10}" width="116" height="22" rx="10" fill="${accent}" />
      <!-- Kissen 1 (oben klein) -->
      <rect x="${x - 44}" y="${y - 32}" width="88" height="20" rx="9" fill="${accent}" />
      <!-- Luftanschlüsse -->
      <line x1="${x - 64}" y1="${y + 26}" x2="${x - 80}" y2="${y + 26}" stroke-width="4" />
      <line x1="${x - 52}" y1="${y + 2}" x2="${x - 78}" y2="${y + 2}" stroke-width="4" />
      <line x1="${x - 38}" y1="${y - 22}" x2="${x - 76}" y2="${y - 22}" stroke-width="4" />
    </g>
  `;
};

/** Unterbaumaterial: Gestapelte Holzklötze im Kreuzmuster. */
const iconUnterbau: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <!-- Untere Lage: längs -->
      <rect x="${x - 60}" y="${y + 22}" width="120" height="16" fill="${accent}" />
      <!-- Mitte: quer (zwei Balken) -->
      <rect x="${x - 50}" y="${y + 2}" width="22" height="22" fill="${accent}" />
      <rect x="${x + 28}" y="${y + 2}" width="22" height="22" fill="${accent}" />
      <!-- Oben: längs -->
      <rect x="${x - 60}" y="${y - 18}" width="120" height="16" fill="${accent}" />
      <!-- Oberste Lage: quer -->
      <rect x="${x - 50}" y="${y - 38}" width="22" height="22" fill="${accent}" />
      <rect x="${x + 28}" y="${y - 38}" width="22" height="22" fill="${accent}" />
      <!-- Maserung -->
      <line x1="${x - 50}" y1="${y + 30}" x2="${x + 50}" y2="${y + 30}" stroke-width="1.2" />
      <line x1="${x - 50}" y1="${y - 10}" x2="${x + 50}" y2="${y - 10}" stroke-width="1.2" />
    </g>
  `;
};

/** Feuerwehrwerkzeugkasten: Box mit Griff und Verschlüssen. */
const iconWerkzeugkasten: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Kastenkorpus -->
      <rect x="${x - 70}" y="${y - 20}" width="140" height="60" rx="4" fill="${accent}" />
      <!-- Deckelkante -->
      <line x1="${x - 70}" y1="${y - 2}" x2="${x + 70}" y2="${y - 2}" stroke-width="3" />
      <!-- Griff -->
      <rect x="${x - 24}" y="${y - 40}" width="48" height="10" rx="4" fill="${accent}" />
      <path d="M ${x - 14} ${y - 40} L ${x - 14} ${y - 20}" stroke-width="3" />
      <path d="M ${x + 14} ${y - 40} L ${x + 14} ${y - 20}" stroke-width="3" />
      <!-- Verschlüsse -->
      <rect x="${x - 50}" y="${y - 8}" width="12" height="14" fill="${ink}" />
      <rect x="${x + 38}" y="${y - 8}" width="12" height="14" fill="${ink}" />
    </g>
  `;
};

/** Glasmanagement-Set: Glassägeblatt + Federkörner. */
const iconGlasmanagement: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Glassäge: Griff -->
      <rect x="${x - 70}" y="${y + 6}" width="50" height="18" rx="4" fill="${accent}" />
      <!-- Glassäge: Blatt mit Zähnen -->
      <path d="M ${x - 20} ${y + 10} L ${x + 50} ${y + 10} L ${x + 50} ${y + 20} L ${x - 20} ${y + 20} Z" fill="#d0d0d0" />
      <path d="M ${x - 16} ${y + 20} l 6 6 l 6 -6 l 6 6 l 6 -6 l 6 6 l 6 -6 l 6 6 l 6 -6 l 6 6 l 6 -6" fill="${ink}" stroke-width="1.6" />
      <!-- Federkörner oben -->
      <rect x="${x - 18}" y="${y - 38}" width="50" height="14" rx="3" fill="${accent}" />
      <path d="M ${x + 32} ${y - 31} L ${x + 58} ${y - 31}" stroke-width="4" />
      <path d="M ${x + 58} ${y - 36} L ${x + 70} ${y - 31} L ${x + 58} ${y - 26} Z" fill="${ink}" />
    </g>
  `;
};

/** Schleifkorbtrage: Korbtrage mit Bügeln. */
const iconTrage: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Korbform -->
      <path d="M ${x - 70} ${y - 10} Q ${x - 75} ${y + 20} ${x - 55} ${y + 30} L ${x + 55} ${y + 30} Q ${x + 75} ${y + 20} ${x + 70} ${y - 10} Z" fill="${accent}" />
      <!-- Gitterstreben -->
      <line x1="${x - 50}" y1="${y - 4}" x2="${x - 42}" y2="${y + 28}" stroke-width="2" />
      <line x1="${x - 25}" y1="${y - 8}" x2="${x - 20}" y2="${y + 28}" stroke-width="2" />
      <line x1="${x}" y1="${y - 10}" x2="${x}" y2="${y + 30}" stroke-width="2" />
      <line x1="${x + 25}" y1="${y - 8}" x2="${x + 20}" y2="${y + 28}" stroke-width="2" />
      <line x1="${x + 50}" y1="${y - 4}" x2="${x + 42}" y2="${y + 28}" stroke-width="2" />
      <line x1="${x - 68}" y1="${y + 4}" x2="${x + 68}" y2="${y + 4}" stroke-width="2" />
      <line x1="${x - 64}" y1="${y + 18}" x2="${x + 64}" y2="${y + 18}" stroke-width="2" />
      <!-- Griffe links/rechts -->
      <path d="M ${x - 70} ${y - 10} Q ${x - 82} ${y - 20} ${x - 72} ${y - 30}" fill="none" stroke-width="4" />
      <path d="M ${x + 70} ${y - 10} Q ${x + 82} ${y - 20} ${x + 72} ${y - 30}" fill="none" stroke-width="4" />
    </g>
  `;
};

/** Spineboard: Flaches Rettungsbrett mit Grifflöchern. */
const iconSpineboard: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Brett -->
      <rect x="${x - 70}" y="${y - 26}" width="140" height="52" rx="10" fill="${accent}" />
      <!-- Grifflöcher (zwei Reihen) -->
      <rect x="${x - 60}" y="${y - 18}" width="18" height="10" rx="3" fill="${ink}" />
      <rect x="${x - 60}" y="${y + 8}" width="18" height="10" rx="3" fill="${ink}" />
      <rect x="${x - 10}" y="${y - 18}" width="18" height="10" rx="3" fill="${ink}" />
      <rect x="${x - 10}" y="${y + 8}" width="18" height="10" rx="3" fill="${ink}" />
      <rect x="${x + 42}" y="${y - 18}" width="18" height="10" rx="3" fill="${ink}" />
      <rect x="${x + 42}" y="${y + 8}" width="18" height="10" rx="3" fill="${ink}" />
      <!-- Mittellinie -->
      <line x1="${x - 62}" y1="${y}" x2="${x + 62}" y2="${y}" stroke-width="1.4" stroke-dasharray="4 4" />
    </g>
  `;
};

/** Mehrzweckzug: Greifzug mit Hebel und Seil. */
const iconMehrzweckzug: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Korpus -->
      <rect x="${x - 50}" y="${y - 16}" width="80" height="40" rx="4" fill="${accent}" />
      <!-- Seil durch Korpus -->
      <line x1="${x - 80}" y1="${y + 4}" x2="${x + 75}" y2="${y + 4}" stroke-width="4" />
      <!-- Hebel -->
      <rect x="${x - 5}" y="${y - 60}" width="10" height="44" rx="3" fill="${ink}" />
      <circle cx="${x}" cy="${y - 60}" r="6" fill="${accent}" />
      <!-- Haken rechts -->
      <path d="M ${x + 75} ${y + 4} Q ${x + 85} ${y + 4} ${x + 85} ${y + 14} Q ${x + 85} ${y + 24} ${x + 75} ${y + 24}" fill="none" stroke-width="4" />
      <!-- Karabiner links -->
      <circle cx="${x - 82}" cy="${y + 4}" r="7" fill="none" stroke-width="3.5" />
    </g>
  `;
};

/** Seilwinde: Trommel mit aufgewickeltem Seil auf Plattform. */
const iconSeilwinde: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Plattform -->
      <rect x="${x - 72}" y="${y + 24}" width="144" height="14" rx="3" fill="${ink}" />
      <!-- Seitenteile -->
      <rect x="${x - 60}" y="${y - 28}" width="14" height="52" fill="${accent}" />
      <rect x="${x + 46}" y="${y - 28}" width="14" height="52" fill="${accent}" />
      <!-- Trommel -->
      <rect x="${x - 46}" y="${y - 20}" width="92" height="40" fill="${accent}" />
      <!-- Seil-Windungen -->
      <line x1="${x - 40}" y1="${y - 14}" x2="${x + 40}" y2="${y - 14}" stroke-width="1.6" />
      <line x1="${x - 40}" y1="${y - 6}" x2="${x + 40}" y2="${y - 6}" stroke-width="1.6" />
      <line x1="${x - 40}" y1="${y + 2}" x2="${x + 40}" y2="${y + 2}" stroke-width="1.6" />
      <line x1="${x - 40}" y1="${y + 10}" x2="${x + 40}" y2="${y + 10}" stroke-width="1.6" />
      <!-- Motor rechts -->
      <rect x="${x + 60}" y="${y - 14}" width="18" height="32" rx="3" fill="${ink}" />
      <!-- Seilauslass -->
      <path d="M ${x - 46} ${y} Q ${x - 68} ${y + 14} ${x - 80} ${y + 22}" fill="none" stroke-width="3" />
    </g>
  `;
};

/** Umlenkrolle: Rolle/Pulley mit Haken. */
const iconUmlenkrolle: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Gehäuse (zwei Seitenplatten) -->
      <path d="M ${x - 38} ${y - 10} Q ${x - 38} ${y + 32} ${x} ${y + 34} Q ${x + 38} ${y + 32} ${x + 38} ${y - 10} L ${x + 38} ${y - 28} L ${x - 38} ${y - 28} Z" fill="${accent}" />
      <!-- Rollenrad -->
      <circle cx="${x}" cy="${y + 10}" r="26" fill="#d0d0d0" />
      <circle cx="${x}" cy="${y + 10}" r="6" fill="${ink}" />
      <line x1="${x - 26}" y1="${y + 10}" x2="${x + 26}" y2="${y + 10}" stroke-width="1.4" />
      <line x1="${x}" y1="${y - 16}" x2="${x}" y2="${y + 36}" stroke-width="1.4" />
      <!-- Aufhängung/Öse oben -->
      <circle cx="${x}" cy="${y - 36}" r="10" fill="none" stroke-width="4" />
      <line x1="${x}" y1="${y - 26}" x2="${x}" y2="${y - 28}" stroke-width="4" />
    </g>
  `;
};

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

// -- Registry-Einträge -------------------------------------------------------
// Spezifischere Keywords stehen vor generischen.
ICON_REGISTRY.push(
  // G1
  [/rettungsschere|\bschere\b/, iconSchere],
  [/spreizer/, iconSpreizer],
  [/zylinder/, iconZylinder],
  [/hydraulikpumpe/, iconHydraulikpumpe],
  [/hydraulikschlauchhaspel|\bhaspel\b/, iconHaspel],
  [/hebekissen/, iconHebekissen],
  [/unterbau/, iconUnterbau],
  [/werkzeugkasten/, iconWerkzeugkasten],
  [/glasmanagement/, iconGlasmanagement],
  [/schleifkorbtrage|\btrage\b/, iconTrage],
  [/spineboard/, iconSpineboard],
  [/mehrzweckzug/, iconMehrzweckzug],
  [/seilwinde/, iconSeilwinde],
  [/umlenkrolle/, iconUmlenkrolle],
);

generate();
