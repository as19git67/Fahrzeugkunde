/**
 * Kodierung des Aufbewahrungsorts im Gegenstands-Formular.
 *
 * Regression: Optionen hießen "position:<id>", Vorbelegung und Auflösung
 * erwarteten "pos:<id>". Folge: Für an einer Position verortete Gegenstände
 * öffnete das Formular mit „— keine —", und jedes Speichern setzte den Ort
 * auf null – „Aufbewahrungsort eingeben und dann speichern speichert nicht".
 */
import { describe, it, expect } from "vitest";
import {
  resolveTargetKey,
  targetKey,
  targetKeyForItem,
  type LocationTarget,
} from "@/lib/item-target";

const targets: LocationTarget[] = [
  { kind: "position", id: 7, positionId: 7, boxId: null, label: "Links → G1 → oben" },
  { kind: "box", id: 3, positionId: 7, boxId: 3, label: "Links → G1 → oben → 📦 rot" },
  { kind: "position", id: 8, positionId: 8, boxId: null, label: "Links → G1 → unten" },
];

describe("targetKeyForItem", () => {
  it("nutzt exakt die Kodierung der Optionen (Position)", () => {
    expect(targetKeyForItem({ positionId: 7, boxId: null })).toBe(targetKey("position", 7));
  });

  it("bevorzugt die Kiste, wenn der Gegenstand in einer liegt", () => {
    expect(targetKeyForItem({ positionId: 7, boxId: 3 })).toBe(targetKey("box", 3));
  });

  it("liefert '' für unverortete Gegenstände und für null", () => {
    expect(targetKeyForItem({ positionId: null, boxId: null })).toBe("");
    expect(targetKeyForItem(null)).toBe("");
  });

  it("ist zur Auflösung invers – ein geöffnetes und unverändert gespeichertes Formular behält den Ort", () => {
    for (const placement of [
      { positionId: 7, boxId: null },
      { positionId: 7, boxId: 3 },
      { positionId: null, boxId: null },
    ]) {
      expect(resolveTargetKey(targetKeyForItem(placement), targets)).toEqual(placement);
    }
  });
});

describe("resolveTargetKey", () => {
  it("löst eine Position auf positionId ohne Kiste auf", () => {
    expect(resolveTargetKey("position:8", targets)).toEqual({ positionId: 8, boxId: null });
  });

  it("löst eine Kiste auf Kiste + zugehörige Position auf", () => {
    expect(resolveTargetKey("box:3", targets)).toEqual({ positionId: 7, boxId: 3 });
  });

  it("'' bedeutet unverortet", () => {
    expect(resolveTargetKey("", targets)).toEqual({ positionId: null, boxId: null });
  });

  it("unbekannter Wert (Ziel inzwischen gelöscht) ergibt null statt still 'unverortet'", () => {
    expect(resolveTargetKey("position:999", targets)).toBeNull();
    expect(resolveTargetKey("pos:7", targets)).toBeNull();
  });
});
