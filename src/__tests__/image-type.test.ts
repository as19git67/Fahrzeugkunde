/**
 * Unit-Tests für die inhaltsbasierte Bildtyp-Erkennung (src/lib/image-type.ts).
 * Braucht keine Datenbank – läuft immer.
 */
import { describe, it, expect } from "vitest";
import {
  ALLOWED_UPLOAD_FOLDERS,
  RASTER_IMAGE_TYPES,
  normalizeImageExt,
  sniffImageType,
  svgSafetyProblem,
} from "@/lib/image-type";

export const JPG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
export const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
export const GIF_BYTES = Buffer.from("GIF89a\0\0\0\0", "latin1");
export const WEBP_BYTES = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from("WEBPVP8 "),
]);
export const SVG_CLEAN = Buffer.from(
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10">' +
    '<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
    '<rect width="10" height="10" fill="url(#g)"/><use xlink:href="#g"/></svg>'
);

describe("sniffImageType", () => {
  it("erkennt JPG, PNG, GIF und WebP an den Magic Bytes", () => {
    expect(sniffImageType(JPG_BYTES)).toBe("jpg");
    expect(sniffImageType(PNG_BYTES)).toBe("png");
    expect(sniffImageType(GIF_BYTES)).toBe("gif");
    expect(sniffImageType(WEBP_BYTES)).toBe("webp");
  });

  it("erkennt SVG mit XML-Prolog, BOM, Kommentar und DOCTYPE", () => {
    expect(sniffImageType(SVG_CLEAN)).toBe("svg");
    expect(sniffImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("svg");
    expect(
      sniffImageType(
        Buffer.from(
          '﻿<!-- Kommentar -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x.dtd">\n<svg></svg>'
        )
      )
    ).toBe("svg");
  });

  it("liefert null für HTML, Text, leere Daten und zu kurze Header", () => {
    expect(sniffImageType(Buffer.from("<html><body>hi</body></html>"))).toBeNull();
    expect(sniffImageType(Buffer.from("nur Text"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
    expect(sniffImageType(Buffer.from([0xff, 0xd8]))).toBeNull();
    // "RIFF" ohne "WEBP" ist z. B. WAV/AVI
    expect(sniffImageType(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WAVE")]))).toBeNull();
  });

  it("lässt sich nicht durch ein <svg> mitten im Text täuschen", () => {
    expect(sniffImageType(Buffer.from("<html><svg></svg></html>"))).toBeNull();
  });
});

describe("svgSafetyProblem", () => {
  const svg = (inner: string) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`);

  it("akzeptiert ein gewöhnliches SVG mit Gradient und internem use-Verweis", () => {
    expect(svgSafetyProblem(SVG_CLEAN)).toBeNull();
  });

  it("meldet Script, Event-Handler und javascript:-URLs", () => {
    expect(svgSafetyProblem(svg("<script>alert(1)</script>"))).toMatch(/script/i);
    expect(svgSafetyProblem(svg('<rect onload="alert(1)"/>'))).toMatch(/Event-Handler/);
    expect(svgSafetyProblem(svg('<a href="javascript:alert(1)"><rect/></a>'))).toMatch(/javascript/);
  });

  it("meldet foreignObject, eingebettete Dokumente und Entities", () => {
    expect(svgSafetyProblem(svg("<foreignObject><div/></foreignObject>"))).toMatch(/foreignObject/);
    expect(svgSafetyProblem(svg('<iframe src="x"/>'))).toMatch(/eingebettetes/);
    expect(
      svgSafetyProblem(Buffer.from('<!DOCTYPE svg [<!ENTITY x "y">]><svg>&x;</svg>'))
    ).toMatch(/ENTITY/);
  });

  it("meldet externe Referenzen und data:-URLs", () => {
    expect(svgSafetyProblem(svg('<image href="https://evil.example/x.png"/>'))).toMatch(/extern/);
    expect(svgSafetyProblem(svg('<image xlink:href="//evil.example/x.png"/>'))).toMatch(/extern/);
    expect(svgSafetyProblem(svg('<image href="data:text/html,x"/>'))).toMatch(/data:/);
    expect(svgSafetyProblem(svg("<style>@import url(x.css)</style>"))).toMatch(/@import/);
    expect(svgSafetyProblem(svg('<rect style="fill:url(https://x/y)"/>'))).toMatch(/url\(\)/);
  });
});

describe("Konstanten", () => {
  it("normalisiert jpeg → jpg und Groß-/Kleinschreibung", () => {
    expect(normalizeImageExt("JPEG")).toBe("jpg");
    expect(normalizeImageExt("Png")).toBe("png");
  });

  it("erlaubt für Uploads nur Rasterformate und nur bekannte Ordner", () => {
    expect(RASTER_IMAGE_TYPES.has("svg")).toBe(false);
    expect(ALLOWED_UPLOAD_FOLDERS.has("items")).toBe(true);
    expect(ALLOWED_UPLOAD_FOLDERS.has("seed")).toBe(false);
    expect(ALLOWED_UPLOAD_FOLDERS.has("items/seed")).toBe(false);
  });
});
