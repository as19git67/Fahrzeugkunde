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
  description: string,
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
    description,
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
  item("die", "Rettungsschere", "Hydraulisches Schneidgerät", "th", 2, "left", "G1", "Auszug oben"),
  item("der", "Rettungsspreizer", "Hydraulischer Spreizer", "th", 2, "left", "G1", "Auszug oben"),
  item("der", "Rettungszylinder kurz", "Hydraulischer Rettungszylinder 350 mm", "th", 2, "left", "G1", "Halterung oben mitte"),
  item("der", "Rettungszylinder lang", "Hydraulischer Rettungszylinder 700 mm", "th", 2, "left", "G1", "Halterung oben mitte"),
  item("die", "Hydraulikpumpe", "Motor-Hydraulikaggregat für THL-Geräte", "th", 2, "left", "G1", "Boden links"),
  item("der", "Hydraulikschlauchhaspel", "Doppel-Hydraulikschlauchhaspel", "th", 2, "left", "G1", "Haspel oben"),
  item("der", "Hebekissensatz", "Pneumatischer Hebekissensatz inkl. Steuergerät", "th", 3, "left", "G1", "Schublade mitte"),
  item("das", "Unterbaumaterial", "Abstütz- und Unterbauklötze", "th", 1, "left", "G1", "Boden rechts"),
  item("der", "Feuerwehrwerkzeugkasten", "Werkzeugkasten für technische Hilfe", "werkzeug", 1, "left", "G1", "mitte rechts"),
  item("das", "Glasmanagement-Set", "Werkzeugset zum sicheren Entfernen von Fahrzeugscheiben", "th", 2, "left", "G1", "mitte links"),
  item("die", "Schleifkorbtrage", "Rettungstrage für Patiententransport", "sanitaet", 2, "left", "G1", "Deckenhalterung"),
  item("das", "Spineboard", "Rettungsbrett für Wirbelsäulen-Immobilisation", "sanitaet", 1, "left", "G1", "Deckenhalterung"),
  item("der", "Mehrzweckzug", "Greifzug / Handseilzug 1,6 t", "bergung", 2, "left", "G1", "Kiste Boden", "orange Kiste"),
  item("die", "Seilwinde", "Motorseilwinde zum Ziehen schwerer Lasten", "bergung", 2, "left", "G1", "Kiste Boden", "orange Kiste"),
  item("die", "Umlenkrolle", "Umlenkrolle für Greifzug", "bergung", 1, "left", "G1", "Kiste Boden", "orange Kiste"),

  // ---------- G3 – Werkzeug/Sonder (13) ----------
  item("die", "Ersatz-Pressluftflasche", "Ersatz-Druckluftflasche 6,8 L / 300 bar", "atemschutz", 2, "left", "G3", "Halterung links"),
  item("die", "Motorkettensäge", "Kettensäge mit Schnittschutzausrüstung", "werkzeug", 2, "left", "G3", "Auszug oben"),
  item("die", "Schnittschutzausrüstung", "PSA für Kettensägeneinsatz (Jacke, Hose, Helm)", "werkzeug", 1, "left", "G3", "Schublade oben"),
  item("der", "Trennschleifer", "Benzin-Trennschleifer mit Diamantscheibe", "werkzeug", 2, "left", "G3", "Auszug oben"),
  item("die", "Tauchpumpe", "Schmutzwasser-Tauchpumpe TP 4/1", "wasser", 2, "left", "G3", "Boden"),
  item("das", "Verlängerungskabel", "25 m Kabeltrommel mit Unterverteiler", "elektro", 1, "left", "G3", "unten rechts"),
  item("die", "Brechstange", "Nageleisen 800 mm", "werkzeug", 1, "left", "G3", "Innenwand links"),
  item("der", "Bolzenschneider", "Schwerer Bolzenschneider 900 mm", "werkzeug", 1, "left", "G3", "Innenwand links"),
  item("die", "Feuerwehraxt", "Feuerwehraxt mit Spalthammer", "werkzeug", 1, "left", "G3", "Innenwand rechts"),
  item("das", "Halligan-Tool", "Multifunktions-Einbruchswerkzeug", "werkzeug", 1, "left", "G3", "Innenwand rechts"),
  item("die", "Säbelsäge", "Akku-Säbelsäge", "werkzeug", 1, "left", "G3", "Schublade unten"),
  item("die", "Akku-Bohrmaschine", "Akku-Schlagbohrmaschine 18 V", "werkzeug", 1, "left", "G3", "Schublade unten"),
  item("der", "Einreißhaken", "Einreißhaken 2,5 m", "werkzeug", 1, "left", "G3", "Außenwand"),

  // ---------- G5 – Wasserentnahme (11) ----------
  item("der", "B-Druckschlauch", "20 m formstabiler B-Druckschlauch", "wasser", 1, "left", "G5", "Schlauchpaket oben"),
  item("der", "C-Druckschlauch", "15 m formstabiler C-Druckschlauch", "wasser", 1, "left", "G5", "Schlauchpaket mitte"),
  item("der", "D-Druckschlauch", "5 m D-Druckschlauch für Kleinanwendungen", "wasser", 1, "left", "G5", "Schlauchpaket unten"),
  item("der", "Saugschlauch", "A-Saugschlauch 110 mm, 1,6 m", "wasser", 2, "left", "G5", "Auszug oben"),
  item("der", "Saugkorb", "Saugkorb mit Rückschlagklappe", "wasser", 1, "left", "G5", "Halterung mitte"),
  item("das", "Standrohr", "Standrohr 2B für Überflurhydranten", "wasser", 1, "left", "G5", "Halterung oben"),
  item("der", "Überflurhydrantenschlüssel", "Schlüssel für Überflurhydranten", "wasser", 1, "left", "G5", "Werkzeugleiste"),
  item("der", "Unterflurhydrantenschlüssel", "Hakenschlüssel für Unterflurhydranten", "wasser", 1, "left", "G5", "Werkzeugleiste"),
  item("der", "Kupplungsschlüssel", "ABC-Kupplungsschlüssel", "wasser", 1, "left", "G5", "Werkzeugleiste"),
  item("die", "Schlauchbrücke", "Schlauchbrücke zur Überfahrschutz-Absicherung", "wasser", 1, "left", "G5", "Boden"),
  item("das", "Sammelstück", "Sammelstück A-2B", "armaturen", 1, "left", "G5", "unten mitte"),

  // ---------- G2 – Strom/Licht/Absicherung (11) ----------
  item("der", "Stromerzeuger", "Tragbares Aggregat 8 kVA", "elektro", 2, "right", "G2", "Auszug unten"),
  item("die", "Kabeltrommel", "50 m Gummi-Kabel 3x2,5 mm²", "elektro", 1, "right", "G2", "Halterung oben"),
  item("der", "Flutlichtstrahler", "LED-Strahler 1000 W mit Stativ", "elektro", 2, "right", "G2", "Halterung oben"),
  item("der", "Teleskopmast", "Pneumatischer Lichtmast am Aufbau", "elektro", 3, "right", "G2", "Mastrohr"),
  item("der", "Handscheinwerfer", "Explosionsgeschützte Ex-Handlampe", "elektro", 1, "right", "G2", "Halterung links"),
  item("die", "Stab-Taschenlampe", "Robuste LED-Stablampe", "elektro", 1, "right", "G2", "Halterung links"),
  item("die", "Warnblitzleuchte", "Satz Warnblitzleuchten 4 Stück", "absicherung", 1, "right", "G2", "Kiste oben", "gelbe Kiste"),
  item("der", "Verkehrsleitkegel", "Satz Pylonen 8 Stück", "absicherung", 1, "right", "G2", "Kiste oben", "gelbe Kiste"),
  item("das", "Warndreieck", "Warndreieck zur Absicherung", "absicherung", 1, "right", "G2", "Kiste oben", "gelbe Kiste"),
  item("das", "Faltsignal", "Faltsignal Achtung Unfallstelle", "absicherung", 1, "right", "G2", "Auszug mitte"),
  item("die", "Leitkegel-Tasche", "Tasche für Verkehrsleitkegel", "absicherung", 1, "right", "G2", "unten"),

  // ---------- G4 – Schaum/Löschmittel/Lüfter (10) ----------
  item("der", "Schaummittelbehälter", "20 L Schaummittel Mehrbereichsschaum", "loeschmittel", 1, "right", "G4", "Boden"),
  item("der", "Pulverlöscher", "Feuerlöscher PG12 (12 kg Pulver)", "loeschmittel", 1, "right", "G4", "Halterung links"),
  item("der", "CO2-Löscher", "Feuerlöscher 5 kg Kohlendioxid", "loeschmittel", 1, "right", "G4", "Halterung mitte"),
  item("der", "Wasserlöscher", "Wasserfeuerlöscher 9 L", "loeschmittel", 1, "right", "G4", "Halterung rechts"),
  item("die", "Kübelspritze", "Tragbare Kübelspritze mit 10 L", "loeschmittel", 1, "right", "G4", "oben"),
  item("der", "Überdrucklüfter", "Benzin-Überdrucklüfter", "belueftung", 2, "right", "G4", "Auszug"),
  item("der", "Zumischer Z2", "Schaumzumischer Z2", "armaturen", 2, "right", "G4", "Halterung innen"),
  item("der", "Zumischer Z4", "Schaumzumischer Z4", "armaturen", 2, "right", "G4", "Halterung innen"),
  item("das", "Schaumstrahlrohr", "Schwerschaum-Strahlrohr S2", "armaturen", 2, "right", "G4", "seitlich"),
  item("die", "Fluchthaube", "Fluchthaube für zu Rettende", "atemschutz", 1, "right", "G4", "Fach oben"),

  // ---------- G6 – schnelle Wasserabgabe (8) ----------
  item("der", "Schnellangriffsschlauch", "Formstabiler Schlauch an Haspel, 30 m", "wasser", 1, "right", "G6", "Haspel"),
  item("das", "Hohlstrahlrohr C", "Hohlstrahlrohr C 100–400 l/min", "armaturen", 2, "right", "G6", "oben links"),
  item("das", "Hohlstrahlrohr B", "Hohlstrahlrohr B 200–800 l/min", "armaturen", 2, "right", "G6", "oben rechts"),
  item("das", "C-Mehrzweckstrahlrohr", "C-Strahlrohr mit Sprühstrahl", "armaturen", 1, "right", "G6", "mitte links"),
  item("das", "B-Mehrzweckstrahlrohr", "B-Strahlrohr mit Sprühstrahl", "armaturen", 1, "right", "G6", "mitte rechts"),
  item("das", "Hygieneboard", "Desinfektions- und Reinigungstafel", "sanitaet", 1, "right", "G6", "Tür innen"),
  item("der", "Stützkrümmer", "Stützkrümmer B-Druck", "armaturen", 1, "right", "G6", "Halterung unten"),
  item("das", "Verteilerstück", "Verteiler B-CBC", "armaturen", 1, "right", "G6", "unten mitte"),

  // ---------- Heck (12) ----------
  item("die", "Feuerlöschkreiselpumpe", "FPN 10-2000 Heckpumpe", "pumpe", 3, "back", "Heck", "Pumpenstand mittig"),
  item("das", "Druckbegrenzungsventil", "Druckbegrenzungsventil 10 bar", "armaturen", 2, "back", "Heck", "Halterung Pumpe"),
  item("das", "Ölbindemittel", "Sack Ölbindemittel Typ III", "gefahrgut", 1, "back", "Heck", "Gefahrgut-Fach links"),
  item("das", "Bindevlies", "Ölbindendes Vlies auf Rolle", "gefahrgut", 1, "back", "Heck", "Gefahrgut-Fach links"),
  item("die", "Auffangwanne klein", "Faltauffangwanne 30 L", "gefahrgut", 1, "back", "Heck", "Boden links"),
  item("die", "Auffangwanne groß", "Faltauffangwanne 200 L", "gefahrgut", 2, "back", "Heck", "Boden rechts"),
  item("das", "Leckdichtkissen", "Pneumatisches Leckdichtkissen", "gefahrgut", 2, "back", "Heck", "Kiste oben", "blaue Kiste"),
  item("der", "Chemikalienschutzanzug", "CSA Form 3 mit Stiefeln", "gefahrgut", 3, "back", "Heck", "Haken links"),
  item("der", "Hitzeschutzanzug", "Hitzeschutzanzug Form 2", "gefahrgut", 3, "back", "Heck", "Haken rechts"),
  item("das", "CO-Warngerät", "Kohlenmonoxid-Warngerät", "messtechnik", 2, "back", "Heck", "Halterung oben"),
  item("das", "Ex-Warngerät", "Ex-Mehrgasmessgerät", "messtechnik", 2, "back", "Heck", "Halterung oben"),
  item("der", "Auffangtrichter", "Faltbarer Auffangtrichter", "gefahrgut", 1, "back", "Heck", "Boden mitte"),

  // ---------- Mannschaftsraum (17) ----------
  item("der", "Pressluftatmer A", "PA-Gerät für Atemschutzgeräteträger, Sitz 1", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 1"),
  item("der", "Pressluftatmer B", "PA-Gerät für Atemschutzgeräteträger, Sitz 2", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 2"),
  item("der", "Pressluftatmer C", "PA-Gerät für Atemschutzgeräteträger, Sitz 3", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 3"),
  item("der", "Pressluftatmer D", "PA-Gerät für Atemschutzgeräteträger, Sitz 4", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 4"),
  item("die", "Atemschutzmaske A", "Vollmaske mit Lungenautomat, Sitz 1", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 1", "Maskentasche"),
  item("die", "Atemschutzmaske B", "Vollmaske mit Lungenautomat, Sitz 2", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 2", "Maskentasche"),
  item("die", "Atemschutzmaske C", "Vollmaske mit Lungenautomat, Sitz 3", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 3", "Maskentasche"),
  item("die", "Atemschutzmaske D", "Vollmaske mit Lungenautomat, Sitz 4", "atemschutz", 1, "back", "Mannschaftsraum", "Sitz 4", "Maskentasche"),
  item("die", "Atemschutzüberwachungstafel", "Tafel zur Überwachung von AGT-Trupps", "atemschutz", 2, "back", "Mannschaftsraum", "Tür innen"),
  item("die", "Atemschutznotfalltasche", "Rettungsset für verunfallten AGT", "atemschutz", 2, "back", "Mannschaftsraum", "Staufach Mitte"),
  item("der", "Sanitätskoffer", "Notfallkoffer nach DIN 14142", "sanitaet", 1, "back", "Mannschaftsraum", "Unter Sitz vorn"),
  item("der", "Defibrillator", "Automatisierter externer Defibrillator AED", "sanitaet", 1, "back", "Mannschaftsraum", "Halterung Rückwand"),
  item("die", "Wolldecke", "Wolldecke zum Wärmeerhalt", "sanitaet", 1, "back", "Mannschaftsraum", "Staufach hinten"),
  item("die", "Sauerstoffflasche", "2 L Medizinische Sauerstoffflasche", "sanitaet", 2, "back", "Mannschaftsraum", "Tasche Rückwand"),
  item("das", "Handfunkgerät", "Digitales HRT Tetra-Funkgerät", "funk", 1, "back", "Mannschaftsraum", "Ladeschale"),
  item("die", "Wärmebildkamera", "Wärmebildkamera für Atemschutztrupp", "messtechnik", 2, "back", "Mannschaftsraum", "Halterung vorne"),
  item("die", "Signalpfeife", "Notsignalpfeife am Band", "funk", 1, "back", "Mannschaftsraum", "Halterung links"),

  // ---------- Dach (5) ----------
  item("die", "Steckleiter", "4-teilige Steckleiter", "leitern", 1, "top", "Dach", "Dach rechts"),
  item("die", "Schiebleiter", "3-teilige Schiebleiter", "leitern", 2, "top", "Dach", "Dach links"),
  item("die", "Klappleiter", "Klappleiter 2 m", "leitern", 1, "top", "Dach", "Dach mitte"),
  item("die", "Hakenleiter", "Hakenleiter für Dachrettung", "leitern", 2, "top", "Dach", "Dach mitte hinten"),
  item("das", "Sprungpolster", "Sprungpolster SP16", "leitern", 3, "top", "Dach", "Dach hinten"),
];
