/**
 * Grammatik-Helfer: Einzahl/Mehrzahl in den Spielfragen.
 * Braucht keine Datenbank – läuft immer.
 */
import { describe, it, expect } from "vitest";
import { hereIsStored, verbIst, whereIsPrefix, whereIsQuestion, withArticle } from "@/lib/grammar";

const eine = { name: "Rundschlinge", article: "die", plural: false };
const mehrere = { name: "Rundschlingen", article: "die", plural: true };

describe("grammar", () => {
  it("wählt das Verb nach Einzahl/Mehrzahl", () => {
    expect(verbIst(eine)).toBe("ist");
    expect(verbIst(mehrere)).toBe("sind");
    expect(verbIst({ plural: null })).toBe("ist");
    expect(verbIst({})).toBe("ist");
  });

  it("bildet die Ortsfrage", () => {
    expect(whereIsQuestion(eine)).toBe("Wo ist die Rundschlinge?");
    expect(whereIsQuestion(mehrere)).toBe("Wo sind die Rundschlingen?");
    expect(whereIsQuestion({ name: "Spineboard", article: "das" })).toBe("Wo ist das Spineboard?");
  });

  it("kommt ohne Artikel aus", () => {
    expect(whereIsQuestion({ name: "Unterbaumaterial", article: null })).toBe("Wo ist Unterbaumaterial?");
    expect(whereIsPrefix({ name: "Keile", article: null, plural: true })).toBe("Wo sind");
    expect(withArticle({ name: "Keile", article: "" })).toBe("Keile");
  });

  it("bildet die Auflösung", () => {
    expect(hereIsStored(eine)).toBe("Hier ist die Rundschlinge verstaut");
    expect(hereIsStored(mehrere)).toBe("Hier sind die Rundschlingen verstaut");
  });
});
