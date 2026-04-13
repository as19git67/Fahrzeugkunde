/**
 * Beladeplan für das HLF 20.
 *
 * Aktuell absichtlich leer: die Seed-Infrastruktur steht, die konkreten
 * Ansichten und Gegenstände werden über den Creator gepflegt.
 */

export type Article = "der" | "die" | "das";

export interface ItemSeed {
  article: Article;
  name: string;
  description: string;
  category: string;
  difficulty: number;
  view: "left" | "right" | "back" | "top";
  compartment: string;
  position: string;
  box?: string;
  imagePath: string;
}

export interface ViewDef {
  side: "left" | "right" | "back" | "top";
  label: string;
  imagePath?: string;
}

export const VIEW_DEFS: ViewDef[] = [];

export const HLF20_ITEMS: ItemSeed[] = [];

export function itemSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
