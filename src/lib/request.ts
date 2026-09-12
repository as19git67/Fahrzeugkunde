/**
 * Kleine Helfer zum Einlesen und Prüfen von Client-Eingaben in Route Handlern.
 * Ungültiges JSON oder falsche Typen sollen zu 400 führen, nicht zu einem
 * unbehandelten Fehler (500) tief in der Datenbankschicht.
 *
 * JSON-Body-Felder werden streng geprüft (eine Zahl muss eine Zahl sein);
 * Query-Parameter und Route-Params kommen immer als String und haben dafür
 * eigene Parser.
 */
import type { NextRequest } from "next/server";

/** Liest den JSON-Body; `null`, wenn kein gültiges JSON-Objekt ankommt. */
export async function readJsonObject(
  req: NextRequest
): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await req.json();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

/** Body-Feld: positive Ganzzahl (echte Zahl, kein String) oder `null`. */
export function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** Body-Feld: Ganzzahl ≥ 0 (echte Zahl, kein String) oder `null`. */
export function nonNegativeInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

/** Body-Feld: nicht-leerer String (getrimmt) oder `null`. */
export function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Query-/Route-Parameter: Ganzzahl ≥ `min` aus einem String, sonst `null`.
 * "12" → 12, "abc" / "" / "1.5" / null → null.
 */
export function intParam(value: string | null | undefined, min = 1): number | null {
  if (typeof value !== "string" || !/^-?\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min ? n : null;
}
