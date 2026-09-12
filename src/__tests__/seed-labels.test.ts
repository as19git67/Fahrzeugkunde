/**
 * Namensregeln für die Positionen im Seed-Beladeplan.
 *
 * Die Positionsnamen sind die Antwortoptionen von "Wo ist …?". Beim
 * Durchspielen standen "G4, Fach oben" und "G4, oben" nebeneinander zur
 * Wahl – nicht unterscheidbar. Dieser Test hält die Namen je Fach so, dass
 * kein Name ein bloßes Kürzel eines anderen ist und keine zwei Schemata
 * ("unten …" vs. "Boden …") gemischt werden.
 *
 * Braucht keine Datenbank – läuft immer.
 */
import { describe, it, expect } from "vitest";
import { HLF20_ITEMS } from "@/db/seed-hlf20";

function positionsByCompartment(): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  for (const it of HLF20_ITEMS) {
    if (!map.has(it.compartment)) map.set(it.compartment, new Set());
    map.get(it.compartment)!.add(it.position);
  }
  return new Map([...map].map(([k, v]) => [k, [...v]]));
}

describe("Seed: Positionsnamen je Fach", () => {
  const groups = positionsByCompartment();

  it("kein Positionsname ist nur ein Wort-Suffix eines anderen im selben Fach", () => {
    // z. B. "oben" neben "Fach oben" oder "Halterung oben"
    const problems: string[] = [];
    for (const [comp, labels] of groups) {
      for (const a of labels) {
        for (const b of labels) {
          if (a !== b && b.endsWith(` ${a}`)) problems.push(`${comp}: "${a}" ⊂ "${b}"`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("mischt in einem Fach nicht die Schemata „unten …“ und „Boden …“", () => {
    const problems: string[] = [];
    for (const [comp, labels] of groups) {
      const unten = labels.filter((l) => /^unten\b/i.test(l));
      const boden = labels.filter((l) => /^Boden\b/.test(l));
      if (unten.length && boden.length) problems.push(`${comp}: ${[...unten, ...boden].join(", ")}`);
    }
    expect(problems).toEqual([]);
  });

  it("verwendet keine nackten Richtungswörter, wenn im Fach auch benannte Stellen liegen", () => {
    // "oben" allein ist als Antwortoption zu vage, sobald es daneben
    // "Halterung oben" oder "Fach oben" gibt.
    const bare = /^(oben|unten|links|rechts|mitte)$/i;
    const problems: string[] = [];
    for (const [comp, labels] of groups) {
      const bareOnes = labels.filter((l) => bare.test(l));
      if (bareOnes.length && labels.length > bareOnes.length) {
        problems.push(`${comp}: ${bareOnes.join(", ")}`);
      }
    }
    expect(problems).toEqual([]);
  });
});
