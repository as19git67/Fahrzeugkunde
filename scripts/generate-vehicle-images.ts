/**
 * Generiert SVGs für die vier Fahrzeugansichten des HLF 20/16 im selben
 * Comic/Sketch-Stil wie die Item-Icons.
 *
 *   public/uploads/views/hlf_left.svg
 *   public/uploads/views/hlf_right.svg
 *   public/uploads/views/hlf_back.svg
 *   public/uploads/views/hlf_top.svg
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

// -- HECKANSICHT -------------------------------------------------------------
// Blick von hinten auf den Aufbau: oben Mannschaftsraum-Heckscheibe, Mitte
// Heck-Rolltor (GR) mit Pumpenstand-Andeutung unten, Rücklichter, Kennzeichen.
function renderBack(): string {
  // Grundrisse: Aufbau ist breiter als Kabine-Rück; der Heck-Rolltor nimmt
  // den größten Teil mittig ein. Oben schmälerer Bereich für Heckscheibe
  // Mannschaftsraum (sichtbar über dem Aufbau-Dach).
  const body = `
    <!-- Fahrbahn -->
    <line x1="20" y1="340" x2="780" y2="340" stroke="${INK}" stroke-width="3" />

    <!-- Aufbau-Heckkontur -->
    <rect x="140" y="90" width="520" height="200" fill="${BODY}" stroke="${INK}" stroke-width="3" />

    <!-- Dachkante / obere Leiste -->
    <rect x="136" y="82" width="528" height="12" fill="${CAB}" stroke="${INK}" stroke-width="2.4" />

    <!-- Mannschaftsraum-Heckscheibe (oben in der Aufbau-Rückwand, eher oben mittig) -->
    <rect x="260" y="106" width="280" height="56" fill="${GLASS}" stroke="${INK}" stroke-width="2.6" />
    <line x1="400" y1="106" x2="400" y2="162" stroke="${INK}" stroke-width="1.6" />

    <!-- Heck-Rolltor GR (Ausstieg / Pumpenstand-Zugang) -->
    ${rollDoor(220, 170, 360, 120)}

    <!-- Pumpenstand-Bedienblende (Andeutung: zwei Manometer + Hebel, LINKS neben GR) -->
    <rect x="154" y="178" width="58" height="108" fill="${CHASSIS}" stroke="${INK}" stroke-width="2.4" />
    <circle cx="172" cy="200" r="10" fill="${PAPER_A}" stroke="${INK}" stroke-width="1.8" />
    <line x1="172" y1="200" x2="178" y2="194" stroke="${INK}" stroke-width="1.4" />
    <circle cx="196" cy="200" r="10" fill="${PAPER_A}" stroke="${INK}" stroke-width="1.8" />
    <line x1="196" y1="200" x2="190" y2="194" stroke="${INK}" stroke-width="1.4" />
    <rect x="162" y="220" width="40" height="6" fill="${HUB}" stroke="${INK}" stroke-width="1.2" />
    <rect x="162" y="234" width="40" height="6" fill="${HUB}" stroke="${INK}" stroke-width="1.2" />
    <rect x="162" y="248" width="16" height="24" fill="${LIGHTBAR}" stroke="${INK}" stroke-width="1.4" />
    <rect x="186" y="248" width="16" height="24" fill="#f5c330" stroke="${INK}" stroke-width="1.4" />

    <!-- Elektrik / Abgang RECHTS neben GR -->
    <rect x="588" y="178" width="58" height="108" fill="${CHASSIS}" stroke="${INK}" stroke-width="2.4" />
    <rect x="598" y="188" width="38" height="28" fill="${PAPER_A}" stroke="${INK}" stroke-width="1.6" />
    <line x1="604" y1="198" x2="630" y2="198" stroke="${INK}" stroke-width="1.2" />
    <line x1="604" y1="206" x2="630" y2="206" stroke="${INK}" stroke-width="1.2" />
    <circle cx="605" cy="230" r="4" fill="${INK}" />
    <circle cx="617" cy="230" r="4" fill="${INK}" />
    <circle cx="629" cy="230" r="4" fill="${INK}" />
    <rect x="598" y="246" width="38" height="30" fill="${HUB}" stroke="${INK}" stroke-width="1.4" />

    <!-- Rücklichter (links + rechts vom Rolltor, hoch) -->
    <rect x="150" y="100" width="34" height="60" fill="#c02a1a" stroke="${INK}" stroke-width="2" />
    <rect x="154" y="106" width="26" height="16" fill="#f5c330" stroke="${INK}" stroke-width="1.2" />
    <rect x="154" y="128" width="26" height="12" fill="#f5f5d0" stroke="${INK}" stroke-width="1.2" />
    <rect x="154" y="144" width="26" height="12" fill="#e63b2e" stroke="${INK}" stroke-width="1.2" />

    <rect x="616" y="100" width="34" height="60" fill="#c02a1a" stroke="${INK}" stroke-width="2" />
    <rect x="620" y="106" width="26" height="16" fill="#f5c330" stroke="${INK}" stroke-width="1.2" />
    <rect x="620" y="128" width="26" height="12" fill="#f5f5d0" stroke="${INK}" stroke-width="1.2" />
    <rect x="620" y="144" width="26" height="12" fill="#e63b2e" stroke="${INK}" stroke-width="1.2" />

    <!-- Blaulichtbalken Heck (schmaler als vorn), auf Dach -->
    <rect x="320" y="72" width="160" height="12" rx="3" fill="${LIGHTBAR}" stroke="${INK}" stroke-width="2.4" />
    <line x1="350" y1="72" x2="350" y2="84" stroke="${INK}" stroke-width="1.2" />
    <line x1="380" y1="72" x2="380" y2="84" stroke="${INK}" stroke-width="1.2" />
    <line x1="410" y1="72" x2="410" y2="84" stroke="${INK}" stroke-width="1.2" />
    <line x1="440" y1="72" x2="440" y2="84" stroke="${INK}" stroke-width="1.2" />

    <!-- Leiter-Andeutung auf Dach (hinten sichtbar) -->
    <line x1="146" y1="66" x2="654" y2="66" stroke="${INK}" stroke-width="2.4" />
    <line x1="146" y1="72" x2="654" y2="72" stroke="${INK}" stroke-width="1.4" />

    <!-- Chassis / hintere Stoßstange durchgehend -->
    <rect x="100" y="290" width="600" height="22" fill="${CHASSIS}" stroke="${INK}" stroke-width="3" />

    <!-- Kennzeichen mittig auf der Stoßstange -->
    <rect x="350" y="294" width="100" height="14" fill="${PAPER_A}" stroke="${INK}" stroke-width="1.6" />

    <!-- Anhängerkupplung-Andeutung -->
    <rect x="392" y="308" width="16" height="14" fill="${CHASSIS}" stroke="${INK}" stroke-width="2" />
    <circle cx="400" cy="322" r="7" fill="${HUB}" stroke="${INK}" stroke-width="1.6" />

    <!-- Räder unten (zwei hintere, angedeutet) -->
    ${wheel(180, 318, 22)}
    ${wheel(620, 318, 22)}
  `;
  return wrap("HLF 20 Ansicht Heck", "hlf_back_v1", body);
}

// -- DRAUFSICHT --------------------------------------------------------------
// Von oben: Kabine vorn, dahinter Aufbau-Dach mit Leitern + Dachkästen.
function renderTop(): string {
  // Horizontal: links = Front, rechts = Heck. Gesamtfahrzeug von oben.
  const body = `
    <!-- Umriss Gesamtfahrzeug -->
    <rect x="60" y="90" width="680" height="200" fill="${BODY}" stroke="${INK}" stroke-width="3" rx="6" />

    <!-- Kabinenbereich (vorn = links), etwas dunkler -->
    <rect x="60" y="90" width="190" height="200" fill="${CAB}" stroke="${INK}" stroke-width="3" rx="6" />

    <!-- Windschutzscheibe (Kabinen-Front) -->
    <path d="M 64 140 L 110 104 L 200 104 L 200 176 L 64 176 Z"
          fill="${GLASS}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" />
    <line x1="132" y1="104" x2="132" y2="176" stroke="${INK}" stroke-width="1.6" />

    <!-- Blaulichtbalken quer auf Kabinen-Dach -->
    <rect x="210" y="122" width="32" height="136" rx="4" fill="${LIGHTBAR}" stroke="${INK}" stroke-width="2.4" />
    <line x1="210" y1="150" x2="242" y2="150" stroke="${INK}" stroke-width="1.2" />
    <line x1="210" y1="176" x2="242" y2="176" stroke="${INK}" stroke-width="1.2" />
    <line x1="210" y1="202" x2="242" y2="202" stroke="${INK}" stroke-width="1.2" />
    <line x1="210" y1="228" x2="242" y2="228" stroke="${INK}" stroke-width="1.2" />

    <!-- Trennkante Kabine/Aufbau -->
    <line x1="250" y1="90" x2="250" y2="290" stroke="${INK}" stroke-width="2.6" />

    <!-- Aufbau-Dach: Leitern längs (zwei Leitern nebeneinander) -->
    ${topLadder(268, 118, 430, 38)}
    ${topLadder(268, 170, 430, 38)}

    <!-- Dachkasten / Geräteraum mittig hinter den Leitern -->
    <rect x="268" y="222" width="200" height="46" fill="${ROLL}" stroke="${INK}" stroke-width="2.6" />
    <line x1="268" y1="240" x2="468" y2="240" stroke="${INK}" stroke-width="1.4" />
    <line x1="318" y1="222" x2="318" y2="268" stroke="${INK}" stroke-width="1.4" />
    <line x1="368" y1="222" x2="368" y2="268" stroke="${INK}" stroke-width="1.4" />
    <line x1="418" y1="222" x2="418" y2="268" stroke="${INK}" stroke-width="1.4" />

    <!-- Lüftergitter / Abgas Andeutung rechts vom Dachkasten -->
    <rect x="482" y="222" width="60" height="46" fill="${HUB}" stroke="${INK}" stroke-width="2.4" />
    <line x1="492" y1="230" x2="532" y2="230" stroke="${INK}" stroke-width="1.2" />
    <line x1="492" y1="240" x2="532" y2="240" stroke="${INK}" stroke-width="1.2" />
    <line x1="492" y1="250" x2="532" y2="250" stroke="${INK}" stroke-width="1.2" />
    <line x1="492" y1="260" x2="532" y2="260" stroke="${INK}" stroke-width="1.2" />

    <!-- Lichtmast-Platz (kleines Rechteck hinten am Aufbau, nahe Kabine) -->
    <rect x="560" y="222" width="60" height="46" fill="${CHASSIS}" stroke="${INK}" stroke-width="2.4" />
    <circle cx="590" cy="245" r="10" fill="${LIGHTBAR}" stroke="${INK}" stroke-width="1.8" />

    <!-- Heck-Markierung (dunkler Streifen außen hinten) -->
    <rect x="720" y="90" width="20" height="200" fill="${CHASSIS}" stroke="${INK}" stroke-width="2.4" />

    <!-- Umriss-Linien Aufbau-Rand (Kante-Paneel) -->
    <line x1="250" y1="110" x2="720" y2="110" stroke="${INK}" stroke-width="1.6" opacity="0.6" />
    <line x1="250" y1="270" x2="720" y2="270" stroke="${INK}" stroke-width="1.6" opacity="0.6" />

    <!-- Richtungs-Pfeil (vorn nach links) als Orientierungshilfe, dezent -->
    <g stroke="${INK}" stroke-width="1.6" fill="none" opacity="0.55">
      <line x1="120" y1="64" x2="80" y2="64" />
      <polyline points="90,58 80,64 90,70" stroke-linejoin="round" />
      <line x1="680" y1="64" x2="720" y2="64" />
      <polyline points="710,58 720,64 710,70" stroke-linejoin="round" />
    </g>
  `;
  return wrap("HLF 20 Ansicht Dach", "hlf_top_v1", body);
}

/** Leiter von oben gesehen: zwei Holme + Sprossen. */
function topLadder(x: number, y: number, w: number, h: number): string {
  const rungs: string[] = [];
  const step = 26;
  for (let lx = x + step; lx < x + w; lx += step) {
    rungs.push(`<line x1="${lx}" y1="${y + 3}" x2="${lx}" y2="${y + h - 3}" stroke="${INK}" stroke-width="1.4" />`);
  }
  return `
    <g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${ROLL}" />
      <line x1="${x}" y1="${y + 6}" x2="${x + w}" y2="${y + 6}" stroke-width="1.6" />
      <line x1="${x}" y1="${y + h - 6}" x2="${x + w}" y2="${y + h - 6}" stroke-width="1.6" />
      ${rungs.join("")}
    </g>
  `;
}

// -- Main --------------------------------------------------------------------

function generate(): void {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const files: Array<[string, string]> = [
    ["hlf_left.svg", renderLeft()],
    ["hlf_right.svg", renderRight()],
    ["hlf_back.svg", renderBack()],
    ["hlf_top.svg", renderTop()],
  ];

  for (const [name, svg] of files) {
    fs.writeFileSync(path.join(OUT_DIR, name), svg, "utf8");
  }

  console.log(`Wrote ${files.length} vehicle view SVG(s) to ${path.relative(process.cwd(), OUT_DIR)}`);
}

generate();
