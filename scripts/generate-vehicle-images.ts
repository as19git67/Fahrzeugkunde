/**
 * Generiert SVGs für die vier Fahrzeugansichten des HLF 20/16 im selben
 * Comic/Sketch-Stil wie die Item-Icons.
 *
 *   public/uploads/views/hlf_left.svg
 *   public/uploads/views/hlf_right.svg
 *   public/uploads/views/hlf_back.svg   (TODO — folgt in separatem Block)
 *   public/uploads/views/hlf_top.svg    (TODO — folgt in separatem Block)
 *
 * Keine sichtbaren Texte — nur aria-label.
 *
 *   npx tsx scripts/generate-vehicle-images.ts
 */

import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.join(process.cwd(), "public", "uploads", "views");

// Style-Konstanten (identisch zu generate-seed-images.ts)
const INK = "#1a1a1a";
const PAPER_A = "#f7f1e1";
const PAPER_B = "#e8dfc3";
const BODY = "#d83a2a";      // Feuerrot für den Aufbau
const CAB = "#c02a1a";       // Kabine einen Tick dunkler
const ROLL = "#e0d3a8";      // Rolltor-Oberfläche (hell, Metall)
const TIRE = "#1a1a1a";
const HUB = "#9a9a9a";
const GLASS = "#b8d8f0";
const LIGHTBAR = "#3aa0ff";
const CHASSIS = "#2a2a2a";

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 1000;
}

/** Umschließt einen Inhalt mit Paper-Hintergrund, Doppel-Rahmen und Sketch-Filter. */
function wrap(label: string, seedKey: string, body: string): string {
  const seed = hashSeed(seedKey);
  const safe = label.replace(/"/g, "&quot;");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" role="img" aria-label="${safe}">
  <defs>
    <radialGradient id="paper" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${PAPER_A}" />
      <stop offset="100%" stop-color="${PAPER_B}" />
    </radialGradient>
    <filter id="sketch" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="${seed}" />
      <feDisplacementMap in="SourceGraphic" scale="1.8" />
    </filter>
    <filter id="sketchLight" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="1" seed="${seed + 3}" />
      <feDisplacementMap in="SourceGraphic" scale="1.1" />
    </filter>
  </defs>

  <rect width="800" height="380" fill="url(#paper)" />

  <g fill="none" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round" filter="url(#sketchLight)">
    <rect x="10" y="10" width="780" height="360" stroke-width="2.4" rx="6" />
    <rect x="16" y="16" width="768" height="348" stroke-width="1.2" rx="4" />
  </g>

  <g stroke="${INK}" stroke-width="1" opacity="0.18" filter="url(#sketchLight)">
    <line x1="40" y1="340" x2="120" y2="340" />
    <line x1="40" y1="348" x2="140" y2="348" />
    <line x1="640" y1="340" x2="760" y2="340" />
    <line x1="680" y1="348" x2="760" y2="348" />
  </g>

  <g filter="url(#sketch)">
    ${body}
  </g>
</svg>
`;
}

/** Rolltor mit horizontalen Lamellen + Griff unten mittig. */
function rollDoor(x: number, y: number, w: number, h: number): string {
  const rungs: string[] = [];
  for (let ly = y + 12; ly < y + h - 8; ly += 10) {
    rungs.push(`<line x1="${x + 6}" y1="${ly}" x2="${x + w - 6}" y2="${ly}" stroke="${INK}" stroke-width="1.2" />`);
  }
  return `
    <g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${ROLL}" />
      ${rungs.join("")}
      <!-- Griff unten mittig -->
      <rect x="${x + w / 2 - 18}" y="${y + h - 14}" width="36" height="8" rx="2" fill="${INK}" />
    </g>
  `;
}

/** Kabinen-Türe: schmaler als Rolltor, mit Fenster oben, Griff mittig. */
function cabinDoor(x: number, y: number, w: number, h: number): string {
  return `
    <g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${CAB}" />
      <!-- Fenster -->
      <rect x="${x + 6}" y="${y + 8}" width="${w - 12}" height="${Math.max(40, h * 0.45)}" fill="${GLASS}" />
      <!-- Griff rechts mittig -->
      <rect x="${x + w - 18}" y="${y + h / 2}" width="12" height="4" rx="2" fill="${INK}" />
    </g>
  `;
}

/** Rad: Reifen + Nabe + Speichen-Andeutung. */
function wheel(cx: number, cy: number, r: number): string {
  return `
    <g stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${TIRE}" />
      <circle cx="${cx}" cy="${cy}" r="${r - 12}" fill="${HUB}" />
      <circle cx="${cx}" cy="${cy}" r="4" fill="${INK}" />
      <line x1="${cx - r + 14}" y1="${cy}" x2="${cx + r - 14}" y2="${cy}" stroke-width="1.4" />
      <line x1="${cx}" y1="${cy - r + 14}" x2="${cx}" y2="${cy + r - 14}" stroke-width="1.4" />
    </g>
  `;
}

// -- LINKSANSICHT ------------------------------------------------------------
// Kabine links (Fahrertüre + Türe Mannschaft links), Aufbau rechts mit G1/G3/G5
function renderLeft(): string {
  const body = `
    <!-- Fahrbahn -->
    <line x1="20" y1="340" x2="780" y2="340" stroke="${INK}" stroke-width="3" />

    <!-- Chassis / Rahmen (dunkler Streifen unter Aufbau) -->
    <rect x="40" y="262" width="720" height="28" fill="${CHASSIS}" stroke="${INK}" stroke-width="3" />

    <!-- Aufbau (großer Kasten rechts) -->
    <rect x="300" y="70" width="460" height="192" fill="${BODY}" stroke="${INK}" stroke-width="3" />

    <!-- Kabine (links, leicht niedriger als Aufbau) -->
    <path d="M 40 140 L 110 92 L 300 92 L 300 262 L 40 262 Z"
          fill="${CAB}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" />

    <!-- Windschutzscheibe -->
    <path d="M 52 140 L 118 102 L 166 102 L 166 148 Z"
          fill="${GLASS}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" />

    <!-- Blaulichtbalken auf der Kabine -->
    <rect x="120" y="78" width="170" height="14" rx="4" fill="${LIGHTBAR}" stroke="${INK}" stroke-width="2.4" />
    <line x1="140" y1="78" x2="140" y2="92" stroke="${INK}" stroke-width="1.2" />
    <line x1="170" y1="78" x2="170" y2="92" stroke="${INK}" stroke-width="1.2" />
    <line x1="200" y1="78" x2="200" y2="92" stroke="${INK}" stroke-width="1.2" />
    <line x1="230" y1="78" x2="230" y2="92" stroke="${INK}" stroke-width="1.2" />
    <line x1="260" y1="78" x2="260" y2="92" stroke="${INK}" stroke-width="1.2" />

    <!-- Fahrertüre (vorne, neben Windschutzscheibe) -->
    ${cabinDoor(170, 148, 64, 112)}

    <!-- Türe Mannschaft links (hinten, neben Fahrertüre) -->
    ${cabinDoor(236, 120, 60, 140)}

    <!-- Trittbrett unter Kabine -->
    <rect x="50" y="256" width="246" height="10" fill="${INK}" />

    <!-- G1 Rolltor -->
    ${rollDoor(314, 96, 138, 156)}

    <!-- G3 Rolltor -->
    ${rollDoor(460, 96, 138, 156)}

    <!-- G5 Rolltor -->
    ${rollDoor(606, 96, 138, 156)}

    <!-- Leiter / Dachgepäck (Hinweis auf Leitern oben) -->
    <line x1="320" y1="62" x2="760" y2="62" stroke="${INK}" stroke-width="2.4" />
    <line x1="320" y1="68" x2="760" y2="68" stroke="${INK}" stroke-width="1.4" />

    <!-- Räder -->
    ${wheel(130, 302, 36)}
    ${wheel(640, 302, 36)}

    <!-- Hintere Stoßstange -->
    <rect x="752" y="250" width="14" height="60" fill="${CHASSIS}" stroke="${INK}" stroke-width="2.4" />

    <!-- Scheinwerfer vorne (am Kabinen-Bug) -->
    <rect x="46" y="220" width="18" height="24" fill="#f5f5d0" stroke="${INK}" stroke-width="2" />
    <rect x="46" y="250" width="18" height="10" fill="#f5c330" stroke="${INK}" stroke-width="2" />
  `;
  return wrap("HLF 20 Ansicht links", "hlf_left_v1", body);
}

// -- RECHTSANSICHT -----------------------------------------------------------
// Kabine rechts (Beifahrertüre + Türe Mannschaft rechts), Aufbau links mit G2/G4/G6
function renderRight(): string {
  const body = `
    <line x1="20" y1="340" x2="780" y2="340" stroke="${INK}" stroke-width="3" />

    <!-- Chassis -->
    <rect x="40" y="262" width="720" height="28" fill="${CHASSIS}" stroke="${INK}" stroke-width="3" />

    <!-- Aufbau (links) -->
    <rect x="40" y="70" width="460" height="192" fill="${BODY}" stroke="${INK}" stroke-width="3" />

    <!-- Kabine (rechts, spiegelbildlich) -->
    <path d="M 760 140 L 690 92 L 500 92 L 500 262 L 760 262 Z"
          fill="${CAB}" stroke="${INK}" stroke-width="3" stroke-linejoin="round" />

    <!-- Windschutzscheibe (gespiegelt) -->
    <path d="M 748 140 L 682 102 L 634 102 L 634 148 Z"
          fill="${GLASS}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" />

    <!-- Blaulichtbalken -->
    <rect x="510" y="78" width="170" height="14" rx="4" fill="${LIGHTBAR}" stroke="${INK}" stroke-width="2.4" />
    <line x1="540" y1="78" x2="540" y2="92" stroke="${INK}" stroke-width="1.2" />
    <line x1="570" y1="78" x2="570" y2="92" stroke="${INK}" stroke-width="1.2" />
    <line x1="600" y1="78" x2="600" y2="92" stroke="${INK}" stroke-width="1.2" />
    <line x1="630" y1="78" x2="630" y2="92" stroke="${INK}" stroke-width="1.2" />
    <line x1="660" y1="78" x2="660" y2="92" stroke="${INK}" stroke-width="1.2" />

    <!-- Beifahrertüre (vorne rechts) -->
    ${cabinDoor(566, 148, 64, 112)}

    <!-- Türe Mannschaft rechts (hinter Beifahrertüre) -->
    ${cabinDoor(504, 120, 60, 140)}

    <!-- Trittbrett -->
    <rect x="504" y="256" width="246" height="10" fill="${INK}" />

    <!-- G6 Rolltor (vorn am Aufbau-Ende Richtung Kabine = links) -->
    ${rollDoor(348, 96, 138, 156)}

    <!-- G4 Rolltor -->
    ${rollDoor(202, 96, 138, 156)}

    <!-- G2 Rolltor (hinten am Aufbau = links im Bild) -->
    ${rollDoor(56, 96, 138, 156)}

    <!-- Leiter-Andeutung auf dem Dach -->
    <line x1="40" y1="62" x2="480" y2="62" stroke="${INK}" stroke-width="2.4" />
    <line x1="40" y1="68" x2="480" y2="68" stroke="${INK}" stroke-width="1.4" />

    <!-- Räder -->
    ${wheel(160, 302, 36)}
    ${wheel(670, 302, 36)}

    <!-- Hintere Stoßstange (links im Bild) -->
    <rect x="34" y="250" width="14" height="60" fill="${CHASSIS}" stroke="${INK}" stroke-width="2.4" />

    <!-- Scheinwerfer vorne rechts -->
    <rect x="736" y="220" width="18" height="24" fill="#f5f5d0" stroke="${INK}" stroke-width="2" />
    <rect x="736" y="250" width="18" height="10" fill="#f5c330" stroke="${INK}" stroke-width="2" />
  `;
  return wrap("HLF 20 Ansicht rechts", "hlf_right_v1", body);
}

// -- Main --------------------------------------------------------------------

function generate(): void {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const files: Array<[string, string]> = [
    ["hlf_left.svg", renderLeft()],
    ["hlf_right.svg", renderRight()],
    // hlf_back.svg und hlf_top.svg folgen in einem separaten Block.
  ];

  for (const [name, svg] of files) {
    fs.writeFileSync(path.join(OUT_DIR, name), svg, "utf8");
  }

  console.log(`Wrote ${files.length} vehicle view SVG(s) to ${path.relative(process.cwd(), OUT_DIR)}`);
}

generate();
