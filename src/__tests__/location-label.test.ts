/**
 * Unit-Tests für die Ableitung des Aufbewahrungsorts aus der Fahrzeugstruktur.
 * Braucht keine Datenbank.
 */
import { describe, it, expect } from "vitest";
import { createLocationLabeler, type LocationStructure } from "@/lib/location-label";

/** Fahrzeug mit eindeutigen Fach-Labels (G1 links, G2 rechts). */
const simple: LocationStructure = {
  views: [
    { id: 1, label: "Fahrzeug links" },
    { id: 2, label: "Fahrzeug rechts" },
  ],
  compartments: [
    { id: 10, viewId: 1, label: "G1" },
    { id: 20, viewId: 2, label: "G2" },
  ],
  positions: [
    { id: 100, compartmentId: 10, label: "oben links" },
    { id: 101, compartmentId: 10, label: "unten rechts" },
    { id: 200, compartmentId: 20, label: "Auszug" },
  ],
  boxes: [{ id: 1000, positionId: 101, label: "orange Kiste" }],
};

describe("createLocationLabeler", () => {
  it("setzt den Ort aus Fach und Position zusammen", () => {
    const labelFor = createLocationLabeler(simple);
    expect(labelFor(100, null)).toBe("G1, oben links");
    expect(labelFor(200, null)).toBe("G2, Auszug");
  });

  it("hängt die Kiste an, wenn der Gegenstand in einer liegt", () => {
    const labelFor = createLocationLabeler(simple);
    expect(labelFor(101, 1000)).toBe("G1, unten rechts, orange Kiste");
  });

  it("leitet die Position aus der Kiste ab, wenn nur boxId gesetzt ist", () => {
    const labelFor = createLocationLabeler(simple);
    expect(labelFor(null, 1000)).toBe("G1, unten rechts, orange Kiste");
  });

  it("liefert null für unverortete Gegenstände", () => {
    const labelFor = createLocationLabeler(simple);
    expect(labelFor(null, null)).toBeNull();
    expect(labelFor(undefined)).toBeNull();
  });

  it("liefert null bei Verweisen auf nicht vorhandene Struktur", () => {
    const labelFor = createLocationLabeler(simple);
    expect(labelFor(999, null)).toBeNull();
    expect(labelFor(null, 999)).toBeNull();
  });

  it("stellt die Ansicht voran, wenn ein Fach-Label mehrfach vorkommt", () => {
    // Zwei Fächer heißen "Fach 1" — ohne Ansicht wäre die Antwortoption
    // im Quiz nicht unterscheidbar.
    const ambiguous: LocationStructure = {
      views: [
        { id: 1, label: "Links" },
        { id: 2, label: "Rechts" },
      ],
      compartments: [
        { id: 10, viewId: 1, label: "Fach 1" },
        { id: 20, viewId: 2, label: "Fach 1" },
        { id: 30, viewId: 2, label: "Fach 2" },
      ],
      positions: [
        { id: 100, compartmentId: 10, label: "oben" },
        { id: 200, compartmentId: 20, label: "oben" },
        { id: 300, compartmentId: 30, label: "oben" },
      ],
      boxes: [],
    };
    const labelFor = createLocationLabeler(ambiguous);
    expect(labelFor(100, null)).toBe("Links, Fach 1, oben");
    expect(labelFor(200, null)).toBe("Rechts, Fach 1, oben");
    // Eindeutiges Fach bleibt ohne Ansicht-Präfix
    expect(labelFor(300, null)).toBe("Fach 2, oben");
    // Und die beiden gleichnamigen Fächer sind jetzt unterscheidbar
    expect(labelFor(100, null)).not.toBe(labelFor(200, null));
  });

  it("kommt mit einem leeren Fahrzeug klar", () => {
    const labelFor = createLocationLabeler({
      views: [],
      compartments: [],
      positions: [],
      boxes: [],
    });
    expect(labelFor(1, null)).toBeNull();
  });
});
