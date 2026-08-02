/**
 * Beladeplan für das HLF 20/16 (Hilfeleistungslöschgruppenfahrzeug 20/16),
 * orientiert an DIN 14530-27 mit einer typischen kommunalen Beladung.
 *
 * Strukturvorgaben aus der Praxis:
 *   - links:  Fahrertüre, Türe Mannschaft links, G1, G3, G5
 *   - rechts: Beifahrertüre, Türe Mannschaft rechts, G2, G4, G6
 *   - hinten: Heck (Pumpenstand + Gefahrgut), Mannschaftsraum
 *   - oben:   Dach (Leitern, Sprungpolster)
 *
 * Türen werden als leere Compartments modelliert (sie sind strukturell da,
 * enthalten in der Demo aber noch keine Beladung).
 */

export type Article = "der" | "die" | "das";

export interface ItemSeed {
  article: Article;
  name: string;
  /**
   * Rein bildgenerierungs-seitige Gruppierung: `scripts/generate-seed-images.ts`
   * leitet daraus die Akzentfarbe der Platzhalter-SVGs ab. Es gibt keine
   * `category`-Spalte in der Datenbank und das Spiel wertet sie nicht aus.
   */
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

export interface CompartmentDef {
  view: "left" | "right" | "back" | "top";
  label: string;
}

export const VIEW_DEFS: ViewDef[] = [
  { side: "left", label: "Fahrzeug links", imagePath: "/uploads/views/hlf_left.svg" },
  { side: "right", label: "Fahrzeug rechts", imagePath: "/uploads/views/hlf_right.svg" },
  { side: "back", label: "Fahrzeug hinten", imagePath: "/uploads/views/hlf_back.svg" },
  { side: "top", label: "Fahrzeug oben", imagePath: "/uploads/views/hlf_top.svg" },
];

/**
 * Compartments werden explizit deklariert, damit leere Türen angelegt werden
 * können. Die Reihenfolge legt die sort_order innerhalb einer Seite fest.
 */
export const COMPARTMENT_DEFS: CompartmentDef[] = [
  // linke Seite
  { view: "left", label: "Fahrertüre" },
  { view: "left", label: "Türe Mannschaft links" },
  { view: "left", label: "G1" },
  { view: "left", label: "G3" },
  { view: "left", label: "G5" },
  // rechte Seite
  { view: "right", label: "Beifahrertüre" },
  { view: "right", label: "Türe Mannschaft rechts" },
  { view: "right", label: "G2" },
  { view: "right", label: "G4" },
  { view: "right", label: "G6" },
  // hinten
  { view: "back", label: "Heck" },
  { view: "back", label: "Mannschaftsraum" },
  // oben
  { view: "top", label: "Dach" },
];

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

function img(name: string): string {
  return `/uploads/items/seed/${itemSlug(name)}.svg`;
}

function item(
  article: Article,
  name: string,
  category: string,
  difficulty: number,
  view: ItemSeed["view"],
  compartment: string,
  position: string,
  box?: string
): ItemSeed {
  return {
    article,
    name,
    category,
    difficulty,
    view,
    compartment,
    position,
    box,
    imagePath: img(name),
  };
}

export const HLF20_ITEMS: ItemSeed[] = [
  // ---------- G1 – schwere Hilfeleistung (15) ----------
  item("die", "Rettungsschere", "th", 2, "left", "G1", "Auszug oben"),
  item("der", "Rettungsspreizer", "th", 2, "left", "G1", "Auszug oben"),
  item("der", "Rettungszylinder kurz", "th", 2, "left", "G1", "Halterung oben mitte"),
  item("der", "Rettungszylinder lang", "th", 2, "left", "G1", "Halterung oben mitte"),
  item("die", "Hydraulikpumpe", "th", 2, "left", "G1", "Boden links"),
  item("der", "Hydraulikschlauchhaspel", "th", 2, "left", "G1", "Haspel oben"),
  item("der", "Hebekissensatz", "th", 3, "left", "G1", "Schublade mitte"),
  item("das", "Unterbaumaterial", "th", 1, "left", "G1", "Boden rechts"),
  item("der", "Feuerwehrwerkzeugkasten", "werkzeug", 1, "left", "G1", "mitte rechts"),
  item("das", "Glasmanagement-Set", "th", 2, "left", "G1", "mitte links"),
  item("die", "Schleifkorbtrage", "sanitaet", 2, "left", "G1", "Deckenhalterung"),
  item("das", "Spineboard", "sanitaet", 1, "left", "G1", "Deckenhalterung"),
  item("der", "Mehrzweckzug", "bergung", 2, "left", "G1", "Kiste Boden", "orange Kiste"),
  item("die", "Seilwinde", "bergung", 2, "left", "G1", "Kiste Boden", "orange Kiste"),
  item("die", "Umlenkrolle", "bergung", 1, "left", "G1", "Kiste Boden", "orange Kiste"),

  // ---------- G3 – Werkzeug/Sonder (13) ----------
  item("die", "Ersatz-Pressluftflasche", "atemschutz", 2, "left", "G3", "Halterung links"),
  item("die", "Motorkettensäge", "werkzeug", 2, "left", "G3", "Auszug oben"),
  item("die", "Schnittschutzausrüstung", "werkzeug", 1, "left", "G3", "Schublade oben"),
  item("der", "Trennschleifer", "werkzeug", 2, "left", "G3", "Auszug oben"),
  item("die", "Tauchpumpe", "wasser", 2, "left", "G3", "Boden"),
  item("das", "Verlängerungskabel", "elektro", 1, "left", "G3", "unten rechts"),
  item("die", "Brechstange", "werkzeug", 1, "left", "G3", "Innenwand links"),
  item("der", "Bolzenschneider", "werkzeug", 1, "left", "G3", "Innenwand links"),
  item("die", "Feuerwehraxt", "werkzeug", 1, "left", "G3", "Innenwand rechts"),
  item("das", "Halligan-Tool", "werkzeug", 1, "left", "G3", "Innenwand rechts"),
  item("die", "Säbelsäge", "werkzeug", 1, "left", "G3", "Schublade unten"),
  item("die", "Akku-Bohrmaschine", "werkzeug", 1, "left", "G3", "Schublade unten"),
  item("der", "Einreißhaken", "werkzeug", 1, "left", "G3", "Außenwand"),

  // ---------- G5 – Wasserentnahme (11) ----------
  item("der", "B-Druckschlauch", "wasser", 1, "left", "G5", "Schlauchpaket oben"),
  item("der", "C-Druckschlauch", "wasser", 1, "left", "G5", "Schlauchpaket mitte"),
  item("der", "D-Druckschlauch", "wasser", 1, "left", "G5", "Schlauchpaket unten"),
  item("der", "Saugschlauch", "wasser", 2, "left", "G5", "Auszug oben"),
  item("der", "Saugkorb", "wasser", 1, "left", "G5", "Halterung mitte"),
  item("das", "Standrohr", "wasser", 1, "left", "G5", "Halterung oben"),
  item("der", "Überflurhydrantenschlüssel", "wasser", 1, "left", "G5", "Werkzeugleiste"),
  item("der", "Unterflurhydrantenschlüssel", "wasser", 1, "left", "G5", "Werkzeugleiste"),
  item("der", "Kupplungsschlüssel", "wasser", 1, "left", "G5", "Werkzeugleiste"),
  item("die", "Schlauchbrücke", "wasser", 1, "left", "G5", "Boden"),
  item("das", "Sammelstück", "armaturen", 1, "left", "G5", "unten mitte"),

  // ---------- G2 – Strom/Licht/Absicherung (11) ----------
  item("der", "Stromerzeuger", "elektro", 2, "right", "G2", "Auszug unten"),
  item("die", "Kabeltrommel", "elektro", 1, "right", "G2", "Halterung oben"),
  item("der", "Flutlichtstrahler", "elektro", 2, "right", "G2", "Halterung oben"),
  item("der", "Teleskopmast", "elektro", 3, "right", "G2", "Mastrohr"),
  item("der", "Handscheinwerfer", "elektro", 1, "right", "G2", "Halterung links"),
  item("die", "Stab-Taschenlampe", "elektro", 1, "right", "G2", "Halterung links"),
  item("die", "Warnblitzleuchte", "absicherung", 1, "right", "G2", "Kiste oben", "gelbe Kiste"),
  item("der", "Verkehrsleitkegel", "absicherung", 1, "right", "G2", "Kiste oben", "gelbe Kiste"),
  item("das", "Warndreieck", "absicherung", 1, "right", "G2", "Kiste oben", "gelbe Kiste"),
  item("das", "Faltsignal", "absicherung", 1, "right", "G2", "Auszug mitte"),
  item("die", "Leitkegel-Tasche", "absicherung", 1, "right", "G2", "unten"),

  // ---------- G4 – Schaum/Löschmittel/Lüfter (10) ----------
  item("der", "Schaummittelbehälter", "loeschmittel", 1, "right", "G4", "Boden"),
  item("der", "Pulverlöscher", "loeschmittel", 1, "right", "G4", "Halterung links"),
  item("der", "CO2-Löscher", "loeschmittel", 1, "right", "G4", "Halterung mitte"),
  item("der", "Wasserlöscher", "loeschmittel", 1, "right", "G4", "Halterung rechts"),
  item("die", "Kübelspritze", "loeschmittel", 1, "right", "G4", "oben"),
  item("der", "Überdrucklüfter", "belueftung", 2, "right", "G4", "Auszug"),
  item("der", "Zumischer Z2", "armaturen", 2, "right", "G4", "Halterung innen"),
  item("der", "Zumischer Z4", "armaturen", 2, "right", "G4", "Halterung innen"),
  item("das", "Schaumstrahlrohr", "armaturen", 2, "right", "G4", "seitlich"),
  item("die", "Fluchthaube", "atemschutz", 1, "right", "G4", "Fach oben"),

  // ---------- G6 – schnelle Wasserabgabe (8) ----------
  item("der", "Schnellangriffsschlauch", "wasser", 1, "right", "G6", "Haspel"),
  item("das", "Hohlstrahlrohr C", "armaturen", 2, "right", "G6", "oben links"),
  item("das", "Hohlstrahlrohr B", "armaturen", 2, "right", "G6", "oben rechts"),
  item("das", "C-Mehrzweckstrahlrohr", "armaturen", 1, "right", "G6", "mitte links"),
  item("das", "B-Mehrzweckstrahlrohr", "armaturen", 1, "right", "G6", "mitte rechts"),
  item("das", "Hygieneboard", "sanitaet", 1, "right", "G6", "Tür innen"),
  item("der", "Stützkrümmer", "armaturen", 1, "right", "G6", "Halterung unten"),
  item("das", "Verteilerstück", "armaturen", 1, "right", "G6", "unten mitte"),

  // ---------- Heck (12) ----------
  item("die", "Feuerlöschkreiselpumpe", "pumpe", 3, "back", "Heck", "Pumpenstand mittig"),
  item("das", "Druckbegrenzungsventil", "armaturen", 2, "back", "Heck", "Halterung Pumpe"),
  item("das", "Ölbindemittel", "gefahrgut", 1, "back", "Heck", "Gefahrgut-Fach links"),
  item("das", "Bindevlies", "gefahrgut", 1, "back", "Heck", "Gefahrgut-Fach links"),
  item("die", "Auffangwanne klein", "gefahrgut", 1, "back", "Heck", "Boden links"),
  item("die", "Auffangwanne groß", "gefahrgut", 2, "back", "Heck", "Boden rechts"),
  item("das", "Leckdichtkissen", "gefahrgut", 2, "back", "Heck", "Kiste oben", "blaue Kiste"),
  item("der", "Chemikalienschutzanzug", "gefahrgut", 3, "back", "Heck", "Haken links"),
  item("der", "Hitzeschutzanzug", "gefahrgut", 3, "back", "Heck", "Haken rechts"),
  item("das", "CO-Warngerät", "messtechnik", 2, "back", "Heck", "Halterung oben"),
  item("das", "Ex-Warngerät", "messtechnik", 2, "back", "Heck", "Halterung oben"),
  item("der", "Auffangtrichter", "gefahrgut", 1, "back", "Heck", "Boden mitte"),

  // ---------- Mannschaftsraum (17) ----------
  item("der", "Pressluftatmer A", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 1"),
  item("der", "Pressluftatmer B", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 2"),
  item("der", "Pressluftatmer C", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 3"),
  item("der", "Pressluftatmer D", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 4"),
  item("die", "Atemschutzmaske A", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 1", "Maskentasche"),
  item("die", "Atemschutzmaske B", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 2", "Maskentasche"),
  item("die", "Atemschutzmaske C", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 3", "Maskentasche"),
  item("die", "Atemschutzmaske D", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 4", "Maskentasche"),
  item("die", "Atemschutzüberwachungstafel", "atemschutz", 2, "back", "Mannschaftsraum", "Tür innen"),
  item("die", "Atemschutznotfalltasche", "atemschutz", 2, "back", "Mannschaftsraum", "Staufach Mitte"),
  item("der", "Sanitätskoffer", "sanitaet", 1, "back", "Mannschaftsraum", "Unter Sitz vorn"),
  item("der", "Defibrillator", "sanitaet", 1, "back", "Mannschaftsraum", "Halterung Rückwand"),
  item("die", "Wolldecke", "sanitaet", 1, "back", "Mannschaftsraum", "Staufach hinten"),
  item("die", "Sauerstoffflasche", "sanitaet", 2, "back", "Mannschaftsraum", "Tasche Rückwand"),
  item("das", "Handfunkgerät", "funk", 1, "back", "Mannschaftsraum", "Ladeschale"),
  item("die", "Wärmebildkamera", "messtechnik", 2, "back", "Mannschaftsraum", "Halterung vorne"),
  item("die", "Signalpfeife", "funk", 1, "back", "Mannschaftsraum", "Halterung links"),

  // ---------- Dach (5) ----------
  item("die", "Steckleiter", "leitern", 1, "top", "Dach", "Dach rechts"),
  item("die", "Schiebleiter", "leitern", 2, "top", "Dach", "Dach links"),
  item("die", "Klappleiter", "leitern", 1, "top", "Dach", "Dach mitte"),
  item("die", "Hakenleiter", "leitern", 2, "top", "Dach", "Dach mitte hinten"),
  item("das", "Sprungpolster", "leitern", 3, "top", "Dach", "Dach hinten"),
];
