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

// -- G3 Icons ----------------------------------------------------------------

/** Pressluftflasche: stehende Druckflasche mit Ventilkopf. */
const iconPressluftflasche: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Flaschenkörper -->
      <path d="M ${x - 24} ${y - 30} Q ${x - 24} ${y - 44} ${x - 12} ${y - 44} L ${x + 12} ${y - 44} Q ${x + 24} ${y - 44} ${x + 24} ${y - 30} L ${x + 24} ${y + 48} Q ${x + 24} ${y + 56} ${x + 16} ${y + 56} L ${x - 16} ${y + 56} Q ${x - 24} ${y + 56} ${x - 24} ${y + 48} Z" fill="${accent}" />
      <!-- Schulter-Rille -->
      <line x1="${x - 24}" y1="${y - 20}" x2="${x + 24}" y2="${y - 20}" stroke-width="2" />
      <!-- Ventilkopf -->
      <rect x="${x - 12}" y="${y - 60}" width="24" height="18" rx="3" fill="${ink}" />
      <!-- Handrad -->
      <circle cx="${x}" cy="${y - 64}" r="10" fill="${accent}" />
      <line x1="${x - 10}" y1="${y - 64}" x2="${x + 10}" y2="${y - 64}" stroke-width="2" />
      <line x1="${x}" y1="${y - 74}" x2="${x}" y2="${y - 54}" stroke-width="2" />
      <!-- Manometer-Anschluss -->
      <path d="M ${x + 10} ${y - 50} L ${x + 22} ${y - 42}" stroke-width="3" />
      <circle cx="${x + 26}" cy="${y - 38}" r="5" fill="#ffffff" />
      <!-- Standfuß -->
      <rect x="${x - 28}" y="${y + 54}" width="56" height="6" fill="${ink}" />
    </g>
  `;
};

/** Motorkettensäge: Motorgehäuse + Schwert mit Kette. */
const iconKettensaege: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Motorgehäuse -->
      <rect x="${x - 75}" y="${y - 20}" width="60" height="40" rx="6" fill="${accent}" />
      <!-- Tankdeckel -->
      <circle cx="${x - 65}" cy="${y - 12}" r="5" fill="${ink}" />
      <!-- Griffbügel oben -->
      <path d="M ${x - 60} ${y - 20} Q ${x - 60} ${y - 40} ${x - 30} ${y - 40} Q ${x - 12} ${y - 40} ${x - 12} ${y - 20}" fill="none" stroke-width="3.5" />
      <!-- Hinterer Griff -->
      <path d="M ${x - 76} ${y + 8} Q ${x - 84} ${y + 14} ${x - 74} ${y + 20} L ${x - 60} ${y + 20} L ${x - 60} ${y + 8}" fill="${accent}" />
      <!-- Schwert -->
      <path d="M ${x - 15} ${y - 8} L ${x + 70} ${y - 10} Q ${x + 82} ${y} ${x + 70} ${y + 10} L ${x - 15} ${y + 8} Z" fill="#d0d0d0" />
      <!-- Kette: kurze Striche -->
      <line x1="${x - 8}" y1="${y - 10}" x2="${x + 66}" y2="${y - 12}" stroke-width="1.4" stroke-dasharray="4 3" />
      <line x1="${x - 8}" y1="${y + 10}" x2="${x + 66}" y2="${y + 12}" stroke-width="1.4" stroke-dasharray="4 3" />
      <!-- Schwertnase -->
      <circle cx="${x + 72}" cy="${y}" r="5" fill="#d0d0d0" />
    </g>
  `;
};

/** Schnittschutzausrüstung: PSA-Hose mit Beinen. */
const iconSchnittschutz: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Bund -->
      <rect x="${x - 40}" y="${y - 50}" width="80" height="18" rx="3" fill="${ink}" />
      <!-- Hosenteil -->
      <path d="M ${x - 40} ${y - 32} L ${x + 40} ${y - 32} L ${x + 40} ${y + 56} L ${x + 16} ${y + 56} L ${x + 6} ${y - 10} L ${x - 6} ${y - 10} L ${x - 16} ${y + 56} L ${x - 40} ${y + 56} Z" fill="${accent}" />
      <!-- Reflex-Streifen -->
      <rect x="${x - 40}" y="${y + 20}" width="22" height="8" fill="#ffffff" />
      <rect x="${x + 18}" y="${y + 20}" width="22" height="8" fill="#ffffff" />
      <!-- Taschen -->
      <rect x="${x - 34}" y="${y - 18}" width="20" height="18" fill="none" stroke-width="2" />
      <rect x="${x + 14}" y="${y - 18}" width="20" height="18" fill="none" stroke-width="2" />
      <!-- Gürtelschnalle -->
      <rect x="${x - 6}" y="${y - 48}" width="12" height="14" fill="${accent}" />
    </g>
  `;
};

/** Trennschleifer: Kompakt-Motor mit großer Trennscheibe. */
const iconTrennschleifer: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Motor -->
      <rect x="${x - 78}" y="${y - 22}" width="60" height="44" rx="6" fill="${accent}" />
      <!-- Kühlrippen -->
      <line x1="${x - 66}" y1="${y - 22}" x2="${x - 66}" y2="${y + 22}" stroke-width="1.8" />
      <line x1="${x - 56}" y1="${y - 22}" x2="${x - 56}" y2="${y + 22}" stroke-width="1.8" />
      <line x1="${x - 46}" y1="${y - 22}" x2="${x - 46}" y2="${y + 22}" stroke-width="1.8" />
      <!-- Griffbügel oben -->
      <path d="M ${x - 60} ${y - 22} Q ${x - 50} ${y - 42} ${x - 30} ${y - 42} Q ${x - 24} ${y - 42} ${x - 24} ${y - 22}" fill="none" stroke-width="3.5" />
      <!-- Verbindungsarm zur Scheibe -->
      <rect x="${x - 18}" y="${y - 10}" width="30" height="20" fill="${accent}" />
      <!-- Schutzhaube (halbkreis oben) -->
      <path d="M ${x + 8} ${y + 4} Q ${x + 10} ${y - 46} ${x + 56} ${y - 34}" fill="none" stroke-width="4" />
      <!-- Trennscheibe -->
      <circle cx="${x + 40}" cy="${y + 6}" r="36" fill="#d0d0d0" />
      <circle cx="${x + 40}" cy="${y + 6}" r="6" fill="${ink}" />
      <circle cx="${x + 40}" cy="${y + 6}" r="22" fill="none" stroke-width="1.4" stroke-dasharray="5 5" />
    </g>
  `;
};

/** Tauchpumpe: zylindrisches Gehäuse mit Druckschlauch oben und Saugfuß. */
const iconTauchpumpe: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Druckstutzen oben mit Schlauch -->
      <rect x="${x - 10}" y="${y - 56}" width="20" height="18" fill="${ink}" />
      <path d="M ${x} ${y - 58} Q ${x + 34} ${y - 70} ${x + 60} ${y - 50}" fill="none" stroke-width="5" stroke="${accent}" />
      <path d="M ${x} ${y - 58} Q ${x + 34} ${y - 70} ${x + 60} ${y - 50}" fill="none" stroke-width="5" />
      <!-- Griffring -->
      <circle cx="${x}" cy="${y - 38}" r="10" fill="none" stroke-width="3" />
      <!-- Pumpengehäuse -->
      <rect x="${x - 36}" y="${y - 32}" width="72" height="66" rx="8" fill="${accent}" />
      <!-- Kabelanschluss -->
      <path d="M ${x - 30} ${y - 32} Q ${x - 50} ${y - 30} ${x - 60} ${y - 10}" fill="none" stroke-width="3" />
      <!-- Saugfuß (unten mit Schlitzen) -->
      <path d="M ${x - 44} ${y + 34} L ${x + 44} ${y + 34} L ${x + 34} ${y + 54} L ${x - 34} ${y + 54} Z" fill="${ink}" />
      <line x1="${x - 20}" y1="${y + 40}" x2="${x - 20}" y2="${y + 50}" stroke="#f7f1e1" stroke-width="2" />
      <line x1="${x - 8}" y1="${y + 40}" x2="${x - 8}" y2="${y + 50}" stroke="#f7f1e1" stroke-width="2" />
      <line x1="${x + 4}" y1="${y + 40}" x2="${x + 4}" y2="${y + 50}" stroke="#f7f1e1" stroke-width="2" />
      <line x1="${x + 16}" y1="${y + 40}" x2="${x + 16}" y2="${y + 50}" stroke="#f7f1e1" stroke-width="2" />
    </g>
  `;
};

/** Verlängerungskabel / Kabeltrommel: Trommel mit Steckdose. */
const iconKabel: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Rahmen -->
      <path d="M ${x - 60} ${y + 34} L ${x - 50} ${y - 34} L ${x + 50} ${y - 34} L ${x + 60} ${y + 34}" fill="none" stroke-width="4" />
      <line x1="${x - 64}" y1="${y + 34}" x2="${x + 64}" y2="${y + 34}" stroke-width="4" />
      <!-- Tragegriff oben -->
      <path d="M ${x - 20} ${y - 34} Q ${x} ${y - 54} ${x + 20} ${y - 34}" fill="none" stroke-width="4" />
      <!-- Trommel (Seitenscheibe) -->
      <circle cx="${x}" cy="${y + 4}" r="36" fill="${accent}" />
      <circle cx="${x}" cy="${y + 4}" r="28" fill="none" stroke-width="1.6" />
      <circle cx="${x}" cy="${y + 4}" r="18" fill="none" stroke-width="1.6" />
      <!-- Nabe/Kurbel -->
      <circle cx="${x}" cy="${y + 4}" r="6" fill="${ink}" />
      <line x1="${x}" y1="${y + 4}" x2="${x + 18}" y2="${y - 6}" stroke-width="3" />
      <circle cx="${x + 18}" cy="${y - 6}" r="3.5" fill="${ink}" />
      <!-- Steckdose -->
      <rect x="${x - 54}" y="${y - 8}" width="16" height="22" rx="2" fill="${ink}" />
      <circle cx="${x - 46}" cy="${y + 3}" r="2" fill="${accent}" />
    </g>
  `;
};

/** Brechstange: Nageleisen mit gebogenem Kuhfuß-Ende. */
const iconBrechstange: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Stange (diagonal) -->
      <path d="M ${x - 60} ${y + 40} L ${x + 50} ${y - 40}" stroke-width="10" stroke="${accent}" />
      <path d="M ${x - 60} ${y + 40} L ${x + 50} ${y - 40}" stroke-width="10" fill="none" />
      <!-- Flaches Ende oben rechts -->
      <path d="M ${x + 48} ${y - 38} L ${x + 76} ${y - 60} L ${x + 70} ${y - 46} L ${x + 80} ${y - 48} L ${x + 68} ${y - 30} Z" fill="${ink}" />
      <!-- Kuhfuß-Ende unten links: gebogen mit Kerbe -->
      <path d="M ${x - 58} ${y + 42} Q ${x - 76} ${y + 50} ${x - 74} ${y + 64} L ${x - 68} ${y + 58} L ${x - 60} ${y + 66} L ${x - 56} ${y + 58} Z" fill="${ink}" />
    </g>
  `;
};

/** Bolzenschneider: lange Griffe mit kurzen Schneidebacken. */
const iconBolzenschneider: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Oberer Griff -->
      <path d="M ${x - 80} ${y - 26} L ${x - 4} ${y - 12} L ${x} ${y - 4}" stroke-width="10" stroke="${accent}" fill="none" />
      <!-- Unterer Griff -->
      <path d="M ${x - 80} ${y + 26} L ${x - 4} ${y + 12} L ${x} ${y + 4}" stroke-width="10" stroke="${accent}" fill="none" />
      <!-- Griff-Überzüge -->
      <rect x="${x - 82}" y="${y - 34}" width="30" height="12" rx="3" fill="${ink}" transform="rotate(-8 ${x - 68} ${y - 28})" />
      <rect x="${x - 82}" y="${y + 22}" width="30" height="12" rx="3" fill="${ink}" transform="rotate(8 ${x - 68} ${y + 28})" />
      <!-- Gelenk -->
      <circle cx="${x - 4}" cy="${y}" r="9" fill="${accent}" />
      <circle cx="${x - 4}" cy="${y}" r="3" fill="${ink}" />
      <!-- Schneidebacken -->
      <path d="M ${x - 4} ${y - 6} L ${x + 40} ${y - 18} L ${x + 60} ${y - 2} L ${x + 10} ${y + 2} Z" fill="${ink}" />
      <path d="M ${x - 4} ${y + 6} L ${x + 40} ${y + 18} L ${x + 60} ${y + 2} L ${x + 10} ${y - 2} Z" fill="${ink}" />
    </g>
  `;
};

/** Feuerwehraxt: Axt mit Kopf und Stiel. */
const iconAxt: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Stiel (diagonal) -->
      <path d="M ${x - 60} ${y + 52} L ${x + 40} ${y - 40}" stroke-width="10" stroke="#c9a068" />
      <path d="M ${x - 60} ${y + 52} L ${x + 40} ${y - 40}" stroke-width="10" fill="none" />
      <!-- Knauf -->
      <circle cx="${x - 60}" cy="${y + 52}" r="7" fill="${ink}" />
      <!-- Axtkopf -->
      <path d="M ${x + 30} ${y - 50} L ${x + 66} ${y - 40} L ${x + 78} ${y - 22} L ${x + 72} ${y - 10} L ${x + 44} ${y - 20} L ${x + 30} ${y - 30} Z" fill="${accent}" />
      <!-- Pickel-Spitze hinten -->
      <path d="M ${x + 34} ${y - 40} L ${x + 12} ${y - 62} L ${x + 24} ${y - 30} Z" fill="${ink}" />
      <!-- Schneide-Kante -->
      <line x1="${x + 66}" y1="${y - 40}" x2="${x + 78}" y2="${y - 22}" stroke-width="2" />
    </g>
  `;
};

/** Halligan-Tool: Stange mit Gabel, Spitze und Adze. */
const iconHalligan: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Stange (diagonal) -->
      <path d="M ${x - 50} ${y + 50} L ${x + 40} ${y - 40}" stroke-width="9" stroke="${accent}" />
      <path d="M ${x - 50} ${y + 50} L ${x + 40} ${y - 40}" stroke-width="9" fill="none" />
      <!-- Gabel oben (forked claw) -->
      <path d="M ${x + 38} ${y - 42} L ${x + 64} ${y - 66} L ${x + 52} ${y - 52} L ${x + 70} ${y - 54} L ${x + 54} ${y - 40} Z" fill="${ink}" />
      <!-- Adze (Kreuz-Klinge) in der Mitte -->
      <path d="M ${x + 40} ${y - 40} L ${x + 30} ${y - 60} L ${x + 46} ${y - 46} Z" fill="${ink}" />
      <!-- Spitze/Pike unten links -->
      <path d="M ${x - 50} ${y + 50} L ${x - 72} ${y + 58} L ${x - 60} ${y + 62} L ${x - 76} ${y + 72} L ${x - 56} ${y + 66} Z" fill="${ink}" />
    </g>
  `;
};

/** Säbelsäge: Akku-Gerät mit langem Sägeblatt. */
const iconSaebelsaege: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Korpus -->
      <rect x="${x - 70}" y="${y - 18}" width="60" height="36" rx="8" fill="${accent}" />
      <!-- Griff oben -->
      <path d="M ${x - 60} ${y - 18} Q ${x - 52} ${y - 38} ${x - 32} ${y - 38} Q ${x - 14} ${y - 38} ${x - 14} ${y - 18}" fill="${accent}" />
      <!-- Akku hinten -->
      <rect x="${x - 86}" y="${y + 18}" width="30" height="20" rx="3" fill="${ink}" />
      <!-- Schuh (Anschlag) -->
      <rect x="${x - 16}" y="${y - 8}" width="12" height="18" rx="2" fill="${ink}" />
      <!-- Sägeblatt mit Zähnen -->
      <rect x="${x - 4}" y="${y - 4}" width="70" height="10" fill="#d0d0d0" />
      <path d="M ${x - 4} ${y + 6} l 5 5 l 5 -5 l 5 5 l 5 -5 l 5 5 l 5 -5 l 5 5 l 5 -5 l 5 5 l 5 -5 l 5 5 l 5 -5 l 5 5 l 5 -5" fill="${ink}" stroke-width="1.2" />
      <!-- Auslöser -->
      <path d="M ${x - 42} ${y + 18} L ${x - 42} ${y + 30} L ${x - 34} ${y + 30}" fill="none" stroke-width="3" />
    </g>
  `;
};

/** Akku-Bohrmaschine: Pistolenform mit Bohrfutter und Akkupack. */
const iconBohrmaschine: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Korpus -->
      <path d="M ${x - 40} ${y - 18} L ${x + 20} ${y - 18} L ${x + 20} ${y + 14} L ${x - 20} ${y + 14} L ${x - 12} ${y + 38} L ${x - 38} ${y + 38} L ${x - 46} ${y + 14} L ${x - 40} ${y + 14} Z" fill="${accent}" />
      <!-- Akkupack unten -->
      <rect x="${x - 44}" y="${y + 38}" width="38" height="16" rx="3" fill="${ink}" />
      <!-- Bohrfutter -->
      <rect x="${x + 20}" y="${y - 10}" width="20" height="20" rx="2" fill="${ink}" />
      <!-- Bohrer -->
      <line x1="${x + 40}" y1="${y}" x2="${x + 76}" y2="${y}" stroke-width="4" />
      <path d="M ${x + 50} ${y - 3} l 4 3 l -4 3 m 6 -6 l 4 3 l -4 3 m 6 -6 l 4 3 l -4 3" stroke-width="1.6" fill="none" />
      <!-- Auslöser -->
      <path d="M ${x - 18} ${y + 14} L ${x - 18} ${y + 26} L ${x - 10} ${y + 26}" fill="none" stroke-width="3" />
      <!-- Drehrichtungs-Wahl -->
      <circle cx="${x - 10}" cy="${y - 6}" r="4" fill="${ink}" />
    </g>
  `;
};

/** Einreißhaken: lange Stange mit Spitze und seitlichem Haken. */
const iconEinreisshaken: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Stange (diagonal) -->
      <path d="M ${x - 70} ${y + 46} L ${x + 52} ${y - 40}" stroke-width="8" stroke="#c9a068" />
      <path d="M ${x - 70} ${y + 46} L ${x + 52} ${y - 40}" stroke-width="8" fill="none" />
      <!-- Knauf unten -->
      <circle cx="${x - 70}" cy="${y + 46}" r="6" fill="${ink}" />
      <!-- Spitze oben -->
      <path d="M ${x + 52} ${y - 40} L ${x + 76} ${y - 62} L ${x + 68} ${y - 46} Z" fill="${ink}" />
      <!-- Seitlicher Haken (90° zur Stange) -->
      <path d="M ${x + 40} ${y - 28} Q ${x + 58} ${y - 16} ${x + 46} ${y - 4} Q ${x + 36} ${y - 14} ${x + 34} ${y - 22}" fill="${accent}" />
    </g>
  `;
};

// -- G2 Icons ----------------------------------------------------------------

/** Stromerzeuger: Aggregatkasten mit Tank, Griff, Steckdose. */
const iconStromerzeuger: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Korpus -->
      <rect x="${x - 70}" y="${y - 20}" width="140" height="60" rx="6" fill="${accent}" />
      <!-- Tankdeckel oben -->
      <rect x="${x - 50}" y="${y - 38}" width="100" height="18" rx="4" fill="${accent}" />
      <circle cx="${x}" cy="${y - 29}" r="6" fill="${ink}" />
      <!-- Tragebügel -->
      <path d="M ${x - 40} ${y - 38} Q ${x} ${y - 60} ${x + 40} ${y - 38}" fill="none" stroke-width="4" />
      <!-- Kühlschlitze -->
      <line x1="${x - 56}" y1="${y - 10}" x2="${x - 20}" y2="${y - 10}" stroke-width="2" />
      <line x1="${x - 56}" y1="${y - 2}" x2="${x - 20}" y2="${y - 2}" stroke-width="2" />
      <line x1="${x - 56}" y1="${y + 6}" x2="${x - 20}" y2="${y + 6}" stroke-width="2" />
      <line x1="${x - 56}" y1="${y + 14}" x2="${x - 20}" y2="${y + 14}" stroke-width="2" />
      <!-- Steckdosen -->
      <rect x="${x + 8}" y="${y - 10}" width="22" height="28" rx="2" fill="${ink}" />
      <circle cx="${x + 19}" cy="${y + 4}" r="3" fill="${accent}" />
      <rect x="${x + 38}" y="${y - 10}" width="22" height="28" rx="2" fill="${ink}" />
      <circle cx="${x + 49}" cy="${y + 4}" r="3" fill="${accent}" />
      <!-- Standfüße -->
      <rect x="${x - 60}" y="${y + 40}" width="14" height="8" fill="${ink}" />
      <rect x="${x + 46}" y="${y + 40}" width="14" height="8" fill="${ink}" />
    </g>
  `;
};

/** Flutlichtstrahler: LED-Strahler auf Stativ. */
const iconFlutlicht: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Strahlergehäuse -->
      <rect x="${x - 50}" y="${y - 42}" width="100" height="40" rx="4" fill="${accent}" />
      <!-- Reflektor innen -->
      <rect x="${x - 42}" y="${y - 36}" width="84" height="28" fill="#ffffff" />
      <line x1="${x - 20}" y1="${y - 36}" x2="${x - 20}" y2="${y - 8}" stroke-width="1.6" />
      <line x1="${x}" y1="${y - 36}" x2="${x}" y2="${y - 8}" stroke-width="1.6" />
      <line x1="${x + 20}" y1="${y - 36}" x2="${x + 20}" y2="${y - 8}" stroke-width="1.6" />
      <!-- Bügel -->
      <path d="M ${x - 50} ${y - 22} L ${x - 60} ${y - 22}" stroke-width="3" />
      <path d="M ${x + 50} ${y - 22} L ${x + 60} ${y - 22}" stroke-width="3" />
      <!-- Mittelstange -->
      <rect x="${x - 4}" y="${y - 2}" width="8" height="40" fill="${ink}" />
      <!-- Stativ (drei Beine) -->
      <path d="M ${x} ${y + 38} L ${x - 50} ${y + 58}" stroke-width="4" />
      <path d="M ${x} ${y + 38} L ${x} ${y + 62}" stroke-width="4" />
      <path d="M ${x} ${y + 38} L ${x + 50} ${y + 58}" stroke-width="4" />
      <!-- Lichtstrahlen -->
      <line x1="${x - 36}" y1="${y - 2}" x2="${x - 52}" y2="${y + 10}" stroke-width="1.6" opacity="0.5" />
      <line x1="${x}" y1="${y - 2}" x2="${x}" y2="${y + 14}" stroke-width="1.6" opacity="0.5" />
      <line x1="${x + 36}" y1="${y - 2}" x2="${x + 52}" y2="${y + 10}" stroke-width="1.6" opacity="0.5" />
    </g>
  `;
};

/** Teleskopmast: ausfahrbarer Lichtmast mit Scheinwerferkopf. */
const iconTeleskopmast: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Fußplatte -->
      <rect x="${x - 40}" y="${y + 42}" width="80" height="12" rx="2" fill="${ink}" />
      <!-- Basis-Segment -->
      <rect x="${x - 18}" y="${y + 14}" width="36" height="32" fill="${accent}" />
      <!-- Mitte-Segment -->
      <rect x="${x - 12}" y="${y - 14}" width="24" height="32" fill="${accent}" />
      <!-- Top-Segment -->
      <rect x="${x - 7}" y="${y - 38}" width="14" height="28" fill="${accent}" />
      <!-- Scheinwerferkopf (quer) -->
      <rect x="${x - 50}" y="${y - 52}" width="100" height="18" rx="3" fill="${ink}" />
      <rect x="${x - 44}" y="${y - 48}" width="88" height="10" fill="#ffffff" />
      <line x1="${x - 22}" y1="${y - 48}" x2="${x - 22}" y2="${y - 38}" stroke-width="1.4" />
      <line x1="${x}" y1="${y - 48}" x2="${x}" y2="${y - 38}" stroke-width="1.4" />
      <line x1="${x + 22}" y1="${y - 48}" x2="${x + 22}" y2="${y - 38}" stroke-width="1.4" />
      <!-- Segmenttrennlinien -->
      <line x1="${x - 18}" y1="${y + 14}" x2="${x + 18}" y2="${y + 14}" stroke-width="1.6" />
      <line x1="${x - 12}" y1="${y - 14}" x2="${x + 12}" y2="${y - 14}" stroke-width="1.6" />
    </g>
  `;
};

/** Handscheinwerfer: Handlampe mit breitem Reflektor und Griff. */
const iconHandscheinwerfer: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Reflektorkopf (trapezartig) -->
      <path d="M ${x - 30} ${y - 38} L ${x + 40} ${y - 30} L ${x + 40} ${y + 30} L ${x - 30} ${y + 38} Z" fill="${accent}" />
      <!-- Linse -->
      <path d="M ${x + 40} ${y - 30} L ${x + 50} ${y - 26} L ${x + 50} ${y + 26} L ${x + 40} ${y + 30} Z" fill="#ffffff" />
      <!-- Griff (unten) -->
      <rect x="${x - 20}" y="${y + 32}" width="30" height="24" rx="4" fill="${ink}" />
      <!-- Trigger -->
      <path d="M ${x - 10} ${y + 32} L ${x - 10} ${y + 22} L ${x} ${y + 22}" fill="none" stroke-width="3" />
      <!-- Lichtstrahlen -->
      <line x1="${x + 56}" y1="${y - 20}" x2="${x + 72}" y2="${y - 26}" stroke-width="2" opacity="0.5" />
      <line x1="${x + 56}" y1="${y}" x2="${x + 74}" y2="${y}" stroke-width="2" opacity="0.5" />
      <line x1="${x + 56}" y1="${y + 20}" x2="${x + 72}" y2="${y + 26}" stroke-width="2" opacity="0.5" />
      <!-- Hängeöse hinten -->
      <path d="M ${x - 30} ${y - 20} L ${x - 40} ${y - 14}" stroke-width="3" />
      <circle cx="${x - 42}" cy="${y - 10}" r="5" fill="none" stroke-width="3" />
    </g>
  `;
};

/** Stab-Taschenlampe: zylindrische lange Lampe. */
const iconTaschenlampe: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Kopfstück (dicker) -->
      <rect x="${x - 70}" y="${y - 16}" width="34" height="32" rx="3" fill="${ink}" />
      <!-- Linse vorne -->
      <rect x="${x - 78}" y="${y - 14}" width="10" height="28" fill="#ffffff" />
      <!-- Schaft -->
      <rect x="${x - 36}" y="${y - 10}" width="86" height="20" fill="${accent}" />
      <!-- Griff-Riffel -->
      <line x1="${x - 20}" y1="${y - 10}" x2="${x - 20}" y2="${y + 10}" stroke-width="1.6" />
      <line x1="${x - 8}" y1="${y - 10}" x2="${x - 8}" y2="${y + 10}" stroke-width="1.6" />
      <line x1="${x + 4}" y1="${y - 10}" x2="${x + 4}" y2="${y + 10}" stroke-width="1.6" />
      <line x1="${x + 16}" y1="${y - 10}" x2="${x + 16}" y2="${y + 10}" stroke-width="1.6" />
      <line x1="${x + 28}" y1="${y - 10}" x2="${x + 28}" y2="${y + 10}" stroke-width="1.6" />
      <!-- Endkappe -->
      <rect x="${x + 50}" y="${y - 12}" width="14" height="24" rx="2" fill="${ink}" />
      <!-- Schlaufe -->
      <circle cx="${x + 72}" cy="${y}" r="6" fill="none" stroke-width="3" />
      <!-- Lichtstrahlen -->
      <line x1="${x - 80}" y1="${y - 8}" x2="${x - 90}" y2="${y - 12}" stroke-width="1.6" opacity="0.5" />
      <line x1="${x - 82}" y1="${y}" x2="${x - 94}" y2="${y}" stroke-width="1.6" opacity="0.5" />
      <line x1="${x - 80}" y1="${y + 8}" x2="${x - 90}" y2="${y + 12}" stroke-width="1.6" opacity="0.5" />
    </g>
  `;
};

/** Warnblitzleuchte: gelbe Leuchte mit Blitzsymbol auf Sockel. */
const iconWarnblitz: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Sockel -->
      <rect x="${x - 34}" y="${y + 24}" width="68" height="18" rx="3" fill="${ink}" />
      <!-- Leuchtenkuppel -->
      <path d="M ${x - 30} ${y + 24} L ${x - 30} ${y - 6} Q ${x - 30} ${y - 40} ${x} ${y - 40} Q ${x + 30} ${y - 40} ${x + 30} ${y - 6} L ${x + 30} ${y + 24} Z" fill="${accent}" />
      <!-- Kuppel-Rippen -->
      <line x1="${x - 24}" y1="${y - 28}" x2="${x - 24}" y2="${y + 24}" stroke-width="1.6" />
      <line x1="${x}" y1="${y - 40}" x2="${x}" y2="${y + 24}" stroke-width="1.6" />
      <line x1="${x + 24}" y1="${y - 28}" x2="${x + 24}" y2="${y + 24}" stroke-width="1.6" />
      <!-- Blitzsymbol -->
      <path d="M ${x - 6} ${y - 28} L ${x + 8} ${y - 10} L ${x - 2} ${y - 8} L ${x + 8} ${y + 14} L ${x - 8} ${y - 4} L ${x + 2} ${y - 6} Z" fill="${ink}" />
      <!-- Lichtstrahlen -->
      <line x1="${x - 36}" y1="${y - 32}" x2="${x - 52}" y2="${y - 44}" stroke-width="2" opacity="0.55" />
      <line x1="${x}" y1="${y - 48}" x2="${x}" y2="${y - 62}" stroke-width="2" opacity="0.55" />
      <line x1="${x + 36}" y1="${y - 32}" x2="${x + 52}" y2="${y - 44}" stroke-width="2" opacity="0.55" />
    </g>
  `;
};

/** Verkehrsleitkegel: Pylon mit Reflexstreifen. */
const iconLeitkegel: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Bodenplatte -->
      <rect x="${x - 60}" y="${y + 36}" width="120" height="16" rx="3" fill="${ink}" />
      <!-- Kegelkörper -->
      <path d="M ${x - 44} ${y + 36} L ${x - 10} ${y - 44} L ${x + 10} ${y - 44} L ${x + 44} ${y + 36} Z" fill="${accent}" />
      <!-- Reflexstreifen breit -->
      <rect x="${x - 38}" y="${y + 18}" width="76" height="10" fill="#ffffff" />
      <!-- Reflexstreifen schmal -->
      <rect x="${x - 28}" y="${y - 4}" width="56" height="8" fill="#ffffff" />
      <!-- Spitze -->
      <rect x="${x - 10}" y="${y - 50}" width="20" height="8" rx="2" fill="${ink}" />
    </g>
  `;
};

/** Warndreieck: rotes Dreieck auf Standfuß. */
const iconWarndreieck: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Standkreuz -->
      <rect x="${x - 60}" y="${y + 36}" width="120" height="10" rx="2" fill="${ink}" />
      <rect x="${x - 6}" y="${y + 20}" width="12" height="26" fill="${ink}" />
      <!-- Äußeres Dreieck (rot) -->
      <path d="M ${x} ${y - 50} L ${x + 56} ${y + 24} L ${x - 56} ${y + 24} Z" fill="${accent}" />
      <!-- Inneres Dreieck (ausgeschnitten) -->
      <path d="M ${x} ${y - 30} L ${x + 38} ${y + 16} L ${x - 38} ${y + 16} Z" fill="#f7f1e1" />
    </g>
  `;
};

/** Faltsignal: Absperrtafel mit mehreren Flächen. */
const iconFaltsignal: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Standfuß -->
      <rect x="${x - 40}" y="${y + 38}" width="80" height="10" rx="2" fill="${ink}" />
      <rect x="${x - 6}" y="${y + 24}" width="12" height="20" fill="${ink}" />
      <!-- 3 Tafel-Segmente im Fächer-Look -->
      <path d="M ${x - 66} ${y - 30} L ${x - 66} ${y + 30} L ${x - 36} ${y + 34} L ${x - 36} ${y - 34} Z" fill="${accent}" />
      <path d="M ${x - 20} ${y - 40} L ${x - 20} ${y + 38} L ${x + 20} ${y + 38} L ${x + 20} ${y - 40} Z" fill="${accent}" />
      <path d="M ${x + 36} ${y - 34} L ${x + 36} ${y + 34} L ${x + 66} ${y + 30} L ${x + 66} ${y - 30} Z" fill="${accent}" />
      <!-- diagonale Streifen (Warnmarkierung) -->
      <line x1="${x - 16}" y1="${y - 36}" x2="${x + 16}" y2="${y + 34}" stroke-width="2.5" stroke="#ffffff" />
      <line x1="${x - 16}" y1="${y - 20}" x2="${x + 16}" y2="${y + 50}" stroke-width="2.5" stroke="#ffffff" />
    </g>
  `;
};

/** Leitkegel-Tasche: Tragetasche mit herausragenden Kegelspitzen. */
const iconLeitkegelTasche: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Kegelspitzen heraus -->
      <path d="M ${x - 36} ${y - 8} L ${x - 28} ${y - 42} L ${x - 20} ${y - 8} Z" fill="${accent}" />
      <path d="M ${x - 8} ${y - 8} L ${x} ${y - 48} L ${x + 8} ${y - 8} Z" fill="${accent}" />
      <path d="M ${x + 20} ${y - 8} L ${x + 28} ${y - 42} L ${x + 36} ${y - 8} Z" fill="${accent}" />
      <!-- Tasche (Trapez) -->
      <path d="M ${x - 56} ${y - 8} L ${x + 56} ${y - 8} L ${x + 64} ${y + 44} L ${x - 64} ${y + 44} Z" fill="#6a5638" />
      <path d="M ${x - 56} ${y - 8} L ${x + 56} ${y - 8} L ${x + 64} ${y + 44} L ${x - 64} ${y + 44} Z" fill="none" stroke-width="3.5" />
      <!-- Trageriemen -->
      <path d="M ${x - 40} ${y - 8} Q ${x - 50} ${y - 36} ${x - 20} ${y - 40}" fill="none" stroke-width="4" />
      <path d="M ${x + 40} ${y - 8} Q ${x + 50} ${y - 36} ${x + 20} ${y - 40}" fill="none" stroke-width="4" />
      <!-- Naht -->
      <line x1="${x - 58}" y1="${y + 4}" x2="${x + 58}" y2="${y + 4}" stroke-width="1.6" stroke-dasharray="4 3" />
    </g>
  `;
};

// -- G5 Icons ----------------------------------------------------------------

/** Druckschlauch-Factory: aufgerollter Schlauch in Größenfarbe (B/C/D). */
function makeDruckschlauch(color: string): IconFn {
  return ({ ink, cx, cy }) => {
    const x = cx, y = cy;
    return `
      <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
        <!-- Aufgerollter Schlauch: konzentrische Wülste -->
        <circle cx="${x}" cy="${y + 4}" r="54" fill="${color}" />
        <circle cx="${x}" cy="${y + 4}" r="44" fill="#e6d8b8" />
        <circle cx="${x}" cy="${y + 4}" r="36" fill="${color}" />
        <circle cx="${x}" cy="${y + 4}" r="26" fill="#e6d8b8" />
        <circle cx="${x}" cy="${y + 4}" r="18" fill="${color}" />
        <circle cx="${x}" cy="${y + 4}" r="10" fill="#e6d8b8" />
        <!-- Abgehendes Schlauchende mit Kupplung -->
        <path d="M ${x + 50} ${y + 22} Q ${x + 74} ${y + 40} ${x + 58} ${y + 58}" fill="none" stroke-width="10" stroke="${color}" />
        <path d="M ${x + 50} ${y + 22} Q ${x + 74} ${y + 40} ${x + 58} ${y + 58}" fill="none" stroke-width="10" />
        <!-- Kupplung -->
        <rect x="${x + 46}" y="${y + 54}" width="28" height="12" rx="2" fill="${ink}" transform="rotate(18 ${x + 58} ${y + 58})" />
      </g>
    `;
  };
}

const iconBSchlauch = makeDruckschlauch("#2e8bff");
const iconCSchlauch = makeDruckschlauch("#d83a2a");
const iconDSchlauch = makeDruckschlauch("#f5c330");

/** Saugschlauch: geriffelter A-Schlauch mit zwei dicken Kupplungen. */
const iconSaugschlauch: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Schlauchkörper (leicht geschwungen) -->
      <path d="M ${x - 60} ${y - 20} Q ${x} ${y - 40} ${x + 60} ${y + 20}" stroke-width="26" stroke="${accent}" fill="none" />
      <path d="M ${x - 60} ${y - 20} Q ${x} ${y - 40} ${x + 60} ${y + 20}" stroke-width="26" fill="none" />
      <!-- Riffelung (kurze Querstriche entlang des Bogens) -->
      <line x1="${x - 50}" y1="${y - 34}" x2="${x - 50}" y2="${y - 14}" stroke-width="1.8" />
      <line x1="${x - 34}" y1="${y - 38}" x2="${x - 34}" y2="${y - 18}" stroke-width="1.8" />
      <line x1="${x - 16}" y1="${y - 40}" x2="${x - 14}" y2="${y - 20}" stroke-width="1.8" />
      <line x1="${x + 2}" y1="${y - 38}" x2="${x + 6}" y2="${y - 18}" stroke-width="1.8" />
      <line x1="${x + 18}" y1="${y - 34}" x2="${x + 24}" y2="${y - 14}" stroke-width="1.8" />
      <line x1="${x + 34}" y1="${y - 26}" x2="${x + 40}" y2="${y - 6}" stroke-width="1.8" />
      <line x1="${x + 46}" y1="${y - 14}" x2="${x + 52}" y2="${y + 4}" stroke-width="1.8" />
      <!-- Kupplung links -->
      <rect x="${x - 78}" y="${y - 30}" width="24" height="26" rx="2" fill="${ink}" />
      <rect x="${x - 84}" y="${y - 32}" width="10" height="30" rx="2" fill="${ink}" />
      <!-- Kupplung rechts -->
      <rect x="${x + 54}" y="${y + 10}" width="24" height="26" rx="2" fill="${ink}" transform="rotate(45 ${x + 66} ${y + 23})" />
    </g>
  `;
};

/** Saugkorb: Siebtrichter mit Rückschlagklappe. */
const iconSaugkorb: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Oberer Anschlussstutzen -->
      <rect x="${x - 18}" y="${y - 54}" width="36" height="20" fill="${ink}" />
      <rect x="${x - 22}" y="${y - 34}" width="44" height="10" fill="${ink}" />
      <!-- Siebkorb (gerundeter Kegel) -->
      <path d="M ${x - 50} ${y - 24} Q ${x - 56} ${y + 10} ${x - 30} ${y + 40} L ${x + 30} ${y + 40} Q ${x + 56} ${y + 10} ${x + 50} ${y - 24} Z" fill="${accent}" />
      <!-- Gitter: vertikale Striche -->
      <line x1="${x - 36}" y1="${y - 20}" x2="${x - 26}" y2="${y + 36}" stroke-width="2" />
      <line x1="${x - 18}" y1="${y - 22}" x2="${x - 14}" y2="${y + 38}" stroke-width="2" />
      <line x1="${x}" y1="${y - 24}" x2="${x}" y2="${y + 40}" stroke-width="2" />
      <line x1="${x + 18}" y1="${y - 22}" x2="${x + 14}" y2="${y + 38}" stroke-width="2" />
      <line x1="${x + 36}" y1="${y - 20}" x2="${x + 26}" y2="${y + 36}" stroke-width="2" />
      <!-- Gitter: horizontale Striche -->
      <path d="M ${x - 48} ${y - 8} Q ${x} ${y - 2} ${x + 48} ${y - 8}" fill="none" stroke-width="2" />
      <path d="M ${x - 52} ${y + 10} Q ${x} ${y + 18} ${x + 52} ${y + 10}" fill="none" stroke-width="2" />
      <path d="M ${x - 42} ${y + 28} Q ${x} ${y + 34} ${x + 42} ${y + 28}" fill="none" stroke-width="2" />
    </g>
  `;
};

/** Standrohr: T-förmiges Standrohr mit Handrad und Auslässen. */
const iconStandrohr: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Vertikales Steigrohr -->
      <rect x="${x - 12}" y="${y - 54}" width="24" height="90" fill="${accent}" />
      <!-- Bodenflansch -->
      <rect x="${x - 26}" y="${y + 36}" width="52" height="12" rx="2" fill="${ink}" />
      <!-- Kopfstück (T-quer) -->
      <rect x="${x - 60}" y="${y - 40}" width="120" height="24" rx="4" fill="${accent}" />
      <!-- Zwei Auslässe mit Ventilen -->
      <rect x="${x - 70}" y="${y - 36}" width="14" height="16" fill="${ink}" />
      <rect x="${x + 56}" y="${y - 36}" width="14" height="16" fill="${ink}" />
      <!-- Handrad oben -->
      <circle cx="${x}" cy="${y - 54}" r="14" fill="none" stroke-width="4" />
      <circle cx="${x}" cy="${y - 54}" r="4" fill="${ink}" />
      <line x1="${x - 14}" y1="${y - 54}" x2="${x + 14}" y2="${y - 54}" stroke-width="2" />
      <line x1="${x}" y1="${y - 68}" x2="${x}" y2="${y - 40}" stroke-width="2" />
    </g>
  `;
};

/** Überflurhydrantenschlüssel: langer Vierkantschlüssel mit Kreuzgriff. */
const iconUeberflurschluessel: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Kreuzgriff oben -->
      <rect x="${x - 44}" y="${y - 52}" width="88" height="10" rx="2" fill="${accent}" />
      <rect x="${x - 5}" y="${y - 66}" width="10" height="40" fill="${accent}" />
      <!-- Schaft lang nach unten -->
      <rect x="${x - 6}" y="${y - 42}" width="12" height="80" fill="${accent}" />
      <!-- Vierkantnuss am Ende -->
      <rect x="${x - 14}" y="${y + 38}" width="28" height="20" fill="${ink}" />
      <!-- Innerer Vierkant-Schnitt -->
      <rect x="${x - 6}" y="${y + 44}" width="12" height="10" fill="#f7f1e1" />
    </g>
  `;
};

/** Unterflurhydrantenschlüssel: Hakenschlüssel mit T-Griff. */
const iconUnterflurschluessel: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- T-Griff quer oben -->
      <rect x="${x - 50}" y="${y - 50}" width="100" height="12" rx="3" fill="${accent}" />
      <!-- Schaft (lang) -->
      <rect x="${x - 6}" y="${y - 38}" width="12" height="76" fill="${accent}" />
      <!-- Unten gebogener Haken -->
      <path d="M ${x - 6} ${y + 36} L ${x - 6} ${y + 50} Q ${x - 6} ${y + 60} ${x - 18} ${y + 60} L ${x - 30} ${y + 60} L ${x - 30} ${y + 48}" fill="${accent}" />
      <!-- Unten rechts kleiner Haken-Fortsatz -->
      <rect x="${x + 6}" y="${y + 36}" width="10" height="16" fill="${accent}" />
    </g>
  `;
};

/** Kupplungsschlüssel: kurzer Schlüssel mit zwei Haken-Maulöffnungen. */
const iconKupplungsschluessel: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Schaft -->
      <rect x="${x - 70}" y="${y - 8}" width="140" height="16" rx="3" fill="${accent}" />
      <!-- Linkes Maul -->
      <path d="M ${x - 70} ${y - 16} L ${x - 86} ${y - 24} L ${x - 92} ${y + 4} L ${x - 80} ${y + 20} L ${x - 70} ${y + 16} Z" fill="${accent}" />
      <circle cx="${x - 80}" cy="${y - 2}" r="6" fill="#f7f1e1" />
      <!-- Rechtes Maul -->
      <path d="M ${x + 70} ${y - 16} L ${x + 86} ${y - 24} L ${x + 92} ${y + 4} L ${x + 80} ${y + 20} L ${x + 70} ${y + 16} Z" fill="${accent}" />
      <circle cx="${x + 80}" cy="${y - 2}" r="6" fill="#f7f1e1" />
      <!-- Aufhänge-Loch mittig -->
      <circle cx="${x}" cy="${y}" r="5" fill="#f7f1e1" />
    </g>
  `;
};

/** Schlauchbrücke: Rampe mit Kanälen für Schläuche. */
const iconSchlauchbruecke: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Rampenkörper (Trapez) -->
      <path d="M ${x - 90} ${y + 30} L ${x - 60} ${y - 20} L ${x + 60} ${y - 20} L ${x + 90} ${y + 30} Z" fill="${accent}" />
      <!-- Fahrflächen-Oberseite -->
      <rect x="${x - 60}" y="${y - 24}" width="120" height="8" rx="2" fill="${ink}" />
      <!-- Schlauch-Rinnen -->
      <rect x="${x - 40}" y="${y - 18}" width="22" height="10" rx="3" fill="#f7f1e1" />
      <rect x="${x - 10}" y="${y - 18}" width="22" height="10" rx="3" fill="#f7f1e1" />
      <rect x="${x + 20}" y="${y - 18}" width="22" height="10" rx="3" fill="#f7f1e1" />
      <!-- Bodenlinie -->
      <line x1="${x - 90}" y1="${y + 30}" x2="${x + 90}" y2="${y + 30}" stroke-width="2" />
      <!-- Schrägstreifen -->
      <line x1="${x - 80}" y1="${y + 16}" x2="${x - 68}" y2="${y}" stroke-width="1.8" />
      <line x1="${x - 70}" y1="${y + 26}" x2="${x - 54}" y2="${y + 4}" stroke-width="1.8" />
      <line x1="${x + 80}" y1="${y + 16}" x2="${x + 68}" y2="${y}" stroke-width="1.8" />
      <line x1="${x + 70}" y1="${y + 26}" x2="${x + 54}" y2="${y + 4}" stroke-width="1.8" />
    </g>
  `;
};

/** Sammelstück: Y-förmiger Sammler A aus 2×B. */
const iconSammelstueck: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Zwei Eingangsarme (B) -->
      <path d="M ${x - 70} ${y - 40} L ${x - 50} ${y - 40} L ${x - 10} ${y - 4} L ${x - 30} ${y + 4} Z" fill="${accent}" />
      <path d="M ${x - 70} ${y + 40} L ${x - 50} ${y + 40} L ${x - 10} ${y + 4} L ${x - 30} ${y - 4} Z" fill="${accent}" />
      <!-- Gehäusemitte (Klappen) -->
      <circle cx="${x - 18}" cy="${y}" r="14" fill="${ink}" />
      <!-- Sammelrohr (A) -->
      <rect x="${x - 10}" y="${y - 16}" width="76" height="32" rx="4" fill="${accent}" />
      <!-- Kupplung am Auslass -->
      <rect x="${x + 66}" y="${y - 22}" width="14" height="44" rx="2" fill="${ink}" />
      <!-- Kupplungen Eingänge -->
      <rect x="${x - 82}" y="${y - 50}" width="14" height="24" rx="2" fill="${ink}" />
      <rect x="${x - 82}" y="${y + 26}" width="14" height="24" rx="2" fill="${ink}" />
    </g>
  `;
};

// -- G4 Icons ----------------------------------------------------------------

/** Schaummittelbehälter: Kanister 20 L mit Schraubverschluss und Griff. */
const iconSchaummittel: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Korpus (Kanister) -->
      <path d="M ${x - 44} ${y - 32} L ${x - 44} ${y + 54} L ${x + 44} ${y + 54} L ${x + 44} ${y - 32} L ${x + 20} ${y - 32} L ${x + 20} ${y - 50} L ${x - 4} ${y - 50} L ${x - 4} ${y - 32} Z" fill="${accent}" />
      <!-- Schraubverschluss -->
      <rect x="${x - 6}" y="${y - 60}" width="28" height="12" rx="2" fill="${ink}" />
      <line x1="${x - 4}" y1="${y - 54}" x2="${x + 20}" y2="${y - 54}" stroke-width="1.6" />
      <!-- Tragegriff integriert (Öffnung) -->
      <rect x="${x - 36}" y="${y - 22}" width="24" height="10" rx="3" fill="#f7f1e1" />
      <!-- Etikett -->
      <rect x="${x - 32}" y="${y + 6}" width="64" height="32" fill="#ffffff" />
      <!-- Schaum-Blasen auf Etikett -->
      <circle cx="${x - 14}" cy="${y + 22}" r="6" fill="none" stroke-width="2.4" />
      <circle cx="${x + 2}" cy="${y + 16}" r="5" fill="none" stroke-width="2.4" />
      <circle cx="${x + 14}" cy="${y + 26}" r="4" fill="none" stroke-width="2.4" />
    </g>
  `;
};

/** Feuerlöscher-Factory. */
function makeLoescher(body: string, horn: "nozzle" | "co2" | "water"): IconFn {
  return ({ ink, cx, cy }) => {
    const x = cx, y = cy;
    const hornMarkup = horn === "co2"
      ? `
          <!-- CO2-Schneehorn -->
          <path d="M ${x + 24} ${y - 38} L ${x + 58} ${y - 18} L ${x + 58} ${y - 2} L ${x + 78} ${y + 10} L ${x + 60} ${y + 14} L ${x + 52} ${y - 4} L ${x + 22} ${y - 20} Z" fill="${ink}" />
        `
      : horn === "water"
      ? `
          <!-- Schlauch mit Sprühkopf -->
          <path d="M ${x + 22} ${y - 30} Q ${x + 50} ${y - 20} ${x + 62} ${y + 10}" fill="none" stroke-width="4" />
          <rect x="${x + 54}" y="${y + 8}" width="16" height="12" rx="2" fill="${ink}" />
        `
      : `
          <!-- Pulver-Düse -->
          <path d="M ${x + 22} ${y - 30} Q ${x + 46} ${y - 22} ${x + 56} ${y - 2}" fill="none" stroke-width="4" />
          <path d="M ${x + 50} ${y - 6} L ${x + 64} ${y + 2} L ${x + 52} ${y + 6} Z" fill="${ink}" />
        `;
    return `
      <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
        <!-- Flaschenkörper -->
        <path d="M ${x - 30} ${y - 30} Q ${x - 30} ${y - 42} ${x - 18} ${y - 42} L ${x + 18} ${y - 42} Q ${x + 30} ${y - 42} ${x + 30} ${y - 30} L ${x + 30} ${y + 52} Q ${x + 30} ${y + 60} ${x + 22} ${y + 60} L ${x - 22} ${y + 60} Q ${x - 30} ${y + 60} ${x - 30} ${y + 52} Z" fill="${body}" />
        <!-- Etikett -->
        <rect x="${x - 24}" y="${y + 6}" width="48" height="28" fill="#ffffff" />
        <line x1="${x - 20}" y1="${y + 14}" x2="${x + 20}" y2="${y + 14}" stroke-width="1.4" />
        <line x1="${x - 20}" y1="${y + 22}" x2="${x + 10}" y2="${y + 22}" stroke-width="1.4" />
        <!-- Ventilkopf -->
        <rect x="${x - 14}" y="${y - 50}" width="28" height="12" rx="2" fill="${ink}" />
        <!-- Handhebel -->
        <path d="M ${x - 10} ${y - 50} L ${x + 20} ${y - 60} L ${x + 22} ${y - 54}" fill="${ink}" />
        <!-- Manometer -->
        <circle cx="${x - 20}" cy="${y - 32}" r="6" fill="#ffffff" />
        ${hornMarkup}
      </g>
    `;
  };
}

const iconPulverloescher = makeLoescher("#d83a2a", "nozzle");
const iconCo2loescher = makeLoescher("#1a1a1a", "co2");
const iconWasserloescher = makeLoescher("#2e8bff", "water");

/** Kübelspritze: Eimer mit Handpumpe. */
const iconKuebelspritze: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Eimer (leicht konisch) -->
      <path d="M ${x - 46} ${y + 6} L ${x - 36} ${y + 56} L ${x + 36} ${y + 56} L ${x + 46} ${y + 6} Z" fill="${accent}" />
      <!-- Eimer-Rand -->
      <rect x="${x - 48}" y="${y}" width="96" height="10" rx="3" fill="${ink}" />
      <!-- Tragebügel -->
      <path d="M ${x - 40} ${y + 4} Q ${x} ${y - 30} ${x + 40} ${y + 4}" fill="none" stroke-width="3.5" />
      <!-- Handpumpe (Zylinder) -->
      <rect x="${x - 10}" y="${y - 60}" width="20" height="50" fill="${ink}" />
      <!-- Pumpenkolben-Griff -->
      <rect x="${x - 18}" y="${y - 70}" width="36" height="10" rx="3" fill="${accent}" />
      <!-- Sprühlanze -->
      <path d="M ${x + 10} ${y - 30} L ${x + 70} ${y - 38}" stroke-width="4" />
      <path d="M ${x + 64} ${y - 44} L ${x + 84} ${y - 38} L ${x + 64} ${y - 32} Z" fill="${ink}" />
      <!-- Wasserlinie -->
      <line x1="${x - 40}" y1="${y + 32}" x2="${x + 40}" y2="${y + 32}" stroke-width="1.6" stroke-dasharray="5 4" />
    </g>
  `;
};

/** Überdrucklüfter: großer Motor mit Ventilator-Gitter. */
const iconUeberdrucklueft: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Rahmen -->
      <rect x="${x - 70}" y="${y - 50}" width="140" height="100" rx="10" fill="${accent}" />
      <!-- Bodenkufen -->
      <rect x="${x - 76}" y="${y + 50}" width="40" height="10" rx="2" fill="${ink}" />
      <rect x="${x + 36}" y="${y + 50}" width="40" height="10" rx="2" fill="${ink}" />
      <!-- Schutzgitter (Kreis) -->
      <circle cx="${x}" cy="${y}" r="42" fill="#d0d0d0" />
      <!-- Gitter-Streben -->
      <line x1="${x - 42}" y1="${y}" x2="${x + 42}" y2="${y}" stroke-width="1.8" />
      <line x1="${x}" y1="${y - 42}" x2="${x}" y2="${y + 42}" stroke-width="1.8" />
      <line x1="${x - 30}" y1="${y - 30}" x2="${x + 30}" y2="${y + 30}" stroke-width="1.8" />
      <line x1="${x - 30}" y1="${y + 30}" x2="${x + 30}" y2="${y - 30}" stroke-width="1.8" />
      <!-- Nabe mit Lüfterflügeln -->
      <circle cx="${x}" cy="${y}" r="8" fill="${ink}" />
      <path d="M ${x} ${y - 8} Q ${x + 30} ${y - 20} ${x + 34} ${y - 4}" fill="${accent}" />
      <path d="M ${x + 8} ${y} Q ${x + 20} ${y + 30} ${x + 4} ${y + 34}" fill="${accent}" />
      <path d="M ${x} ${y + 8} Q ${x - 30} ${y + 20} ${x - 34} ${y + 4}" fill="${accent}" />
      <path d="M ${x - 8} ${y} Q ${x - 20} ${y - 30} ${x - 4} ${y - 34}" fill="${accent}" />
      <!-- Motor-Bügel oben -->
      <rect x="${x - 20}" y="${y - 60}" width="40" height="10" rx="3" fill="${ink}" />
    </g>
  `;
};

/** Zumischer-Factory: Inline-Mixer mit Dreh-Dosierring (N Ringe = Z-Nummer/2). */
function makeZumischer(grade: 2 | 4): IconFn {
  return ({ accent, ink, cx, cy }) => {
    const x = cx, y = cy;
    const rings = grade === 2 ? 2 : 4;
    const ringMarks = Array.from({ length: rings }, (_, i) =>
      `<line x1="${x - 4 + i * 2}" y1="${y - 26}" x2="${x - 4 + i * 2}" y2="${y - 18}" stroke-width="2" />`
    ).join("");
    return `
      <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
        <!-- Durchlauf-Rohr -->
        <rect x="${x - 80}" y="${y - 12}" width="160" height="36" rx="6" fill="${accent}" />
        <!-- Kupplung links -->
        <rect x="${x - 86}" y="${y - 18}" width="14" height="48" rx="2" fill="${ink}" />
        <!-- Kupplung rechts -->
        <rect x="${x + 72}" y="${y - 18}" width="14" height="48" rx="2" fill="${ink}" />
        <!-- Dosierring oben (abgesetzter Ring) -->
        <rect x="${x - 20}" y="${y - 34}" width="40" height="24" rx="4" fill="${accent}" />
        <circle cx="${x}" cy="${y - 22}" r="14" fill="#d0d0d0" />
        <circle cx="${x}" cy="${y - 22}" r="4" fill="${ink}" />
        <!-- Skalenstriche am Ring entsprechend Z-Zahl -->
        ${ringMarks}
        <!-- Zumisch-Stutzen unten -->
        <rect x="${x - 10}" y="${y + 24}" width="20" height="18" fill="${ink}" />
        <circle cx="${x}" cy="${y + 50}" r="10" fill="none" stroke-width="3" />
      </g>
    `;
  };
}

const iconZumischerZ2 = makeZumischer(2);
const iconZumischerZ4 = makeZumischer(4);

/** Schaumstrahlrohr: große konische Schaumdüse mit Lufteinlass. */
const iconSchaumstrahlrohr: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Kupplung links -->
      <rect x="${x - 80}" y="${y - 14}" width="14" height="28" rx="2" fill="${ink}" />
      <!-- Rohrstück schmal -->
      <rect x="${x - 66}" y="${y - 10}" width="30" height="20" fill="${accent}" />
      <!-- Hebel/Absperrung -->
      <rect x="${x - 50}" y="${y - 28}" width="8" height="18" fill="${ink}" />
      <!-- Mischkammer (breiter) -->
      <rect x="${x - 36}" y="${y - 18}" width="30" height="36" rx="4" fill="${accent}" />
      <!-- Luftansaugöffnungen -->
      <circle cx="${x - 24}" cy="${y - 4}" r="3" fill="${ink}" />
      <circle cx="${x - 14}" cy="${y - 4}" r="3" fill="${ink}" />
      <circle cx="${x - 24}" cy="${y + 8}" r="3" fill="${ink}" />
      <circle cx="${x - 14}" cy="${y + 8}" r="3" fill="${ink}" />
      <!-- Konus nach rechts -->
      <path d="M ${x - 6} ${y - 18} L ${x + 60} ${y - 40} L ${x + 60} ${y + 40} L ${x - 6} ${y + 18} Z" fill="${accent}" />
      <!-- Sprühmuster / Schaum-Blasen -->
      <circle cx="${x + 70}" cy="${y - 30}" r="6" fill="none" stroke-width="2.4" />
      <circle cx="${x + 80}" cy="${y - 14}" r="5" fill="none" stroke-width="2.4" />
      <circle cx="${x + 84}" cy="${y + 6}" r="7" fill="none" stroke-width="2.4" />
      <circle cx="${x + 74}" cy="${y + 26}" r="5" fill="none" stroke-width="2.4" />
    </g>
  `;
};

/** Fluchthaube: Kopfhaube mit Filter für zu Rettende. */
const iconFluchthaube: IconFn = ({ accent, ink, cx, cy }) => {
  const x = cx, y = cy;
  return `
    <g stroke="${ink}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">
      <!-- Haube (Kopfform) -->
      <path d="M ${x - 50} ${y + 40} Q ${x - 60} ${y - 40} ${x} ${y - 50} Q ${x + 60} ${y - 40} ${x + 50} ${y + 40} Z" fill="${accent}" />
      <!-- Sichtscheibe -->
      <path d="M ${x - 38} ${y - 10} Q ${x - 40} ${y - 30} ${x} ${y - 32} Q ${x + 40} ${y - 30} ${x + 38} ${y - 10} L ${x + 34} ${y + 14} Q ${x} ${y + 20} ${x - 34} ${y + 14} Z" fill="#b8d8f0" />
      <!-- Filter / Ventil (seitlich rechts) -->
      <rect x="${x + 44}" y="${y + 2}" width="22" height="22" rx="4" fill="${ink}" />
      <circle cx="${x + 55}" cy="${y + 13}" r="5" fill="${accent}" />
      <!-- Halsgummi -->
      <rect x="${x - 40}" y="${y + 34}" width="80" height="12" rx="3" fill="${ink}" />
      <!-- Reflex am Visier -->
      <path d="M ${x - 30} ${y - 6} L ${x - 14} ${y - 18}" stroke="#ffffff" stroke-width="3" />
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
  // G3 — spezifische Keywords vor generischen
  [/kettensaege|kettensäge/, iconKettensaege],
  [/saebelsaege|säbelsäge/, iconSaebelsaege],
  [/pressluftflasche/, iconPressluftflasche],
  [/schnittschutz/, iconSchnittschutz],
  [/trennschleifer/, iconTrennschleifer],
  [/tauchpumpe/, iconTauchpumpe],
  [/verlaengerungskabel|verlängerungskabel|kabeltrommel/, iconKabel],
  [/brechstange/, iconBrechstange],
  [/bolzenschneider/, iconBolzenschneider],
  [/feuerwehraxt|\baxt\b/, iconAxt],
  [/halligan/, iconHalligan],
  [/akku-bohrmaschine|bohrmaschine/, iconBohrmaschine],
  [/einreisshaken|einreißhaken/, iconEinreisshaken],
  // G2 — spezifische vor generischen Keywords
  [/stromerzeuger/, iconStromerzeuger],
  [/flutlicht/, iconFlutlicht],
  [/teleskopmast/, iconTeleskopmast],
  [/handscheinwerfer/, iconHandscheinwerfer],
  [/taschenlampe/, iconTaschenlampe],
  [/warnblitz/, iconWarnblitz],
  [/leitkegel-tasche/, iconLeitkegelTasche],
  [/verkehrsleitkegel|leitkegel|pylon/, iconLeitkegel],
  [/warndreieck/, iconWarndreieck],
  [/faltsignal/, iconFaltsignal],
  // G5 — Schläuche spezifisch vor saugschlauch, standrohr vor rohr
  [/b-druckschlauch/, iconBSchlauch],
  [/c-druckschlauch/, iconCSchlauch],
  [/d-druckschlauch/, iconDSchlauch],
  [/saugschlauch/, iconSaugschlauch],
  [/saugkorb/, iconSaugkorb],
  [/standrohr/, iconStandrohr],
  [/ueberflurhydrantenschluessel|überflurhydrantenschlüssel/, iconUeberflurschluessel],
  [/unterflurhydrantenschluessel|unterflurhydrantenschlüssel/, iconUnterflurschluessel],
  [/kupplungsschluessel|kupplungsschlüssel/, iconKupplungsschluessel],
  [/schlauchbruecke|schlauchbrücke/, iconSchlauchbruecke],
  [/sammelstueck|sammelstück/, iconSammelstueck],
  // G4 — spezifische Löscher vor generischen Treffern
  [/schaummittel/, iconSchaummittel],
  [/pulverloescher|pulverlöscher/, iconPulverloescher],
  [/co2-loescher|co2-löscher/, iconCo2loescher],
  [/wasserloescher|wasserlöscher/, iconWasserloescher],
  [/kuebelspritze|kübelspritze/, iconKuebelspritze],
  [/ueberdrucklueft|überdrucklüft/, iconUeberdrucklueft],
  [/zumischer\s*z2/, iconZumischerZ2],
  [/zumischer\s*z4/, iconZumischerZ4],
  [/schaumstrahlrohr/, iconSchaumstrahlrohr],
  [/fluchthaube/, iconFluchthaube],
);

generate();
