/**
 * Erkennung von Bildtypen anhand des Dateiinhalts (Magic Bytes) statt anhand
 * von Client-Angaben. Dateiname und MIME-Typ eines Uploads sind frei wählbar
 * und deshalb für Sicherheitsentscheidungen wertlos: Ein "evil.svg" mit
 * Content-Type image/png darf nie als SVG auf der Platte landen, weil SVG
 * Script enthalten kann und im App-Origin ausgeliefert wird.
 */
export type ImageType = "jpg" | "png" | "webp" | "gif" | "svg";

/** Rasterformate, die Nutzer über /api/upload hochladen dürfen (kein SVG). */
export const RASTER_IMAGE_TYPES: ReadonlySet<ImageType> = new Set<ImageType>([
  "jpg",
  "png",
  "webp",
  "gif",
]);

/**
 * Formate, die ein .fzk-Paket enthalten darf. SVG ist hier erlaubt, weil die
 * kuratierten Seed-Icons SVG sind – dafür wird jedes SVG inhaltlich geprüft
 * (siehe svgSafetyProblem).
 */
export const PACKAGE_IMAGE_TYPES: ReadonlySet<ImageType> = new Set<ImageType>([
  "jpg",
  "png",
  "webp",
  "gif",
  "svg",
]);

/** Ziel-Unterordner unter public/uploads, die die Upload-Route akzeptiert. */
export const ALLOWED_UPLOAD_FOLDERS: ReadonlySet<string> = new Set([
  "items",
  "views",
  "compartments",
  "boxes",
]);

/** Maximale Größe eines einzelnen Bild-Uploads. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MIME_BY_IMAGE_TYPE: Record<ImageType, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
};

/** "jpeg" → "jpg", sonst nur Kleinschreibung. */
export function normalizeImageExt(ext: string): string {
  const e = ext.toLowerCase();
  return e === "jpeg" ? "jpg" : e;
}

function hasBytes(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) {
    if (buf[offset + i] !== bytes[i]) return false;
  }
  return true;
}

// SVG: Text, der nach optionalem BOM, XML-Prolog, Kommentaren und DOCTYPE mit
// <svg beginnt. Nur der Anfang der Datei wird betrachtet.
const SVG_HEAD =
  /^﻿?\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE\s+svg[^>]*>\s*)?<svg[\s>/]/i;

/**
 * Bestimmt den Bildtyp ausschließlich aus dem Inhalt. Liefert `null`, wenn der
 * Inhalt keinem unterstützten Bildformat entspricht (z. B. HTML, Text, PDF).
 */
export function sniffImageType(buf: Buffer): ImageType | null {
  if (hasBytes(buf, [0xff, 0xd8, 0xff])) return "jpg";
  if (hasBytes(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // "GIF87a" / "GIF89a"
  if (
    hasBytes(buf, [0x47, 0x49, 0x46, 0x38]) &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    return "gif";
  }
  // "RIFF" .... "WEBP"
  if (hasBytes(buf, [0x52, 0x49, 0x46, 0x46]) && hasBytes(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "webp";
  }
  const head = buf.subarray(0, 4096).toString("utf8");
  if (SVG_HEAD.test(head)) return "svg";
  return null;
}

// Konstrukte, die in einem SVG Script ausführen, fremde Inhalte nachladen oder
// den Parser angreifen können. Bewusst streng: Pakete enthalten nur Bilder, die
// aus dieser App stammen (Seed-Icons bzw. Raster-Uploads).
const SVG_DENYLIST: ReadonlyArray<[RegExp, string]> = [
  [/<script[\s>/]/i, "<script>"],
  [/\son[a-z]+\s*=/i, "Event-Handler-Attribut (on*=)"],
  [/javascript\s*:/i, "javascript:-URL"],
  [/<foreignobject[\s>/]/i, "<foreignObject>"],
  [/<(?:iframe|embed|object|frame|applet)[\s>/]/i, "eingebettetes Dokument"],
  [/<!ENTITY/i, "<!ENTITY>"],
  [/<\?xml-stylesheet/i, "xml-stylesheet"],
  [/(?:href|src)\s*=\s*["']?\s*data:/i, "data:-URL"],
  [/(?:href|src)\s*=\s*["']?\s*(?:https?:)?\/\//i, "externe Referenz"],
  [/url\(\s*["']?\s*(?:https?:)?\/\//i, "externe url()"],
  [/@import/i, "@import"],
];

/**
 * Prüft ein SVG auf unzulässige Inhalte. Liefert eine kurze Beschreibung des
 * ersten Problems oder `null`, wenn nichts gefunden wurde.
 */
export function svgSafetyProblem(buf: Buffer): string | null {
  const text = buf.toString("utf8");
  for (const [pattern, label] of SVG_DENYLIST) {
    if (pattern.test(text)) return label;
  }
  return null;
}
