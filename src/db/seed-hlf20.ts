/**
 * Beladeplan für das HLF 20 (Hilfeleistungslöschgruppenfahrzeug 20).
 * Orientiert an DIN 14530-27 mit einer typischen kommunalen Beladung.
 *
 * Struktur:
 *   - linke Seite: G1 (Atemschutz), G2 (Elektro/Licht), G3 (Technische Hilfe), G4 (Absturzsicherung)
 *   - rechte Seite: G5 (Wasserentnahme), G6 (Armaturen/Strahlrohre), G7 (Schaum/Löscher), G8 (Werkzeug/Bergung), G9 (Gefahrgut)
 *   - Heck: Pumpenstand / Sanitäts / Funk (Mannschaftsraum)
 *   - Dach (GR): Leitern und Sprungpolster
 */

export type Article = "der" | "die" | "das";

export interface ItemSeed {
  article: Article;
  name: string;
  description: string;
  category: string;
  difficulty: number;
  view: "left" | "right" | "back" | "top";
  compartment: string;   // z.B. "G1"
  position: string;      // z.B. "oben links"
  box?: string;          // optionale Kiste
  imagePath: string;     // Pfad zum SVG (generiert, siehe scripts/generate-seed-images.ts)
}

export interface ViewDef {
  side: "left" | "right" | "back" | "top";
  label: string;
  imagePath?: string;
}

export const VIEW_DEFS: ViewDef[] = [
  { side: "left",  label: "Fahrzeug links",  imagePath: "/uploads/views/hlf_left.svg" },
  { side: "right", label: "Fahrzeug rechts", imagePath: "/uploads/views/hlf_right.svg" },
  { side: "back",  label: "Fahrzeug hinten", imagePath: "/uploads/views/hlf_back.svg" },
  { side: "top",   label: "Fahrzeug oben",   imagePath: "/uploads/views/hlf_top.svg" },
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
  // G1 — Atemschutz (links, hinten)
  item("der", "Pressluftatmer A",       "PA-Gerät für Atemschutzgeräteträger",         "atemschutz", 1, "left", "G1", "oben links"),
  item("der", "Pressluftatmer B",       "PA-Gerät für Atemschutzgeräteträger",         "atemschutz", 1, "left", "G1", "oben rechts"),
  item("der", "Pressluftatmer C",       "PA-Gerät für Atemschutzgeräteträger",         "atemschutz", 1, "left", "G1", "unten links"),
  item("der", "Pressluftatmer D",       "PA-Gerät für Atemschutzgeräteträger",         "atemschutz", 1, "left", "G1", "unten rechts"),
  item("die", "Atemschutzmaske",        "Vollmaske mit Lungenautomat",                 "atemschutz", 1, "left", "G1", "oben mitte"),
  item("die", "Ersatz-Pressluftflasche","Ersatz-Druckluftflasche 6,8 L/300 bar",       "atemschutz", 2, "left", "G1", "unten mitte"),
  item("die", "Atemschutznotfalltasche","Rettungsset für verunfallten AGT",            "atemschutz", 2, "left", "G1", "seitlich rechts"),
  item("die", "Atemschutzüberwachungstafel","Tafel zur Überwachung von AGT-Trupps",    "atemschutz", 2, "left", "G1", "Tür innen"),
  item("die", "Fluchthaube",            "Fluchthaube für zu Rettende",                 "atemschutz", 1, "left", "G1", "seitlich links"),

  // G2 — Elektro & Beleuchtung
  item("der", "Stromerzeuger",          "Tragbares Aggregat 8 kVA",                    "elektro",    2, "left", "G2", "Auszug unten"),
  item("die", "Kabeltrommel",           "50 m Gummi-Kabel 3x2,5 mm²",                  "elektro",    1, "left", "G2", "oben"),
  item("der", "Flutlichtstrahler",      "LED-Strahler 1000 W mit Stativ",              "elektro",    2, "left", "G2", "Halterung Tür"),
  item("der", "Teleskopmast",           "Pneumatischer Lichtmast am Aufbau",           "elektro",    3, "left", "G2", "Mastrohr"),
  item("der", "Handscheinwerfer",       "Explosionsgeschützte Ex-Handlampe",           "elektro",    1, "left", "G2", "Halterung oben links"),
  item("die", "Stab-Taschenlampe",      "Robuste LED-Stablampe",                       "elektro",    1, "left", "G2", "Halterung oben rechts"),
  item("das", "Verlängerungskabel",     "25 m Kabeltrommel mit Unterverteiler",        "elektro",    1, "left", "G2", "unten rechts"),

  // G3 — Technische Hilfeleistung
  item("die", "Rettungsschere",         "Hydraulisches Schneidgerät",                  "th",         2, "left", "G3", "vorne rechts"),
  item("der", "Rettungsspreizer",       "Hydraulischer Spreizer",                      "th",         2, "left", "G3", "vorne links"),
  item("der", "Rettungszylinder kurz",  "Hydraulischer Rettungszylinder 350 mm",       "th",         2, "left", "G3", "mitte oben"),
  item("der", "Rettungszylinder lang",  "Hydraulischer Rettungszylinder 700 mm",       "th",         2, "left", "G3", "mitte unten"),
  item("die", "Hydraulikpumpe",         "Motor-Hydraulikaggregat für THL-Geräte",      "th",         2, "left", "G3", "hinten unten"),
  item("der", "Hydraulikschlauchhaspel","Doppel-Hydraulikschlauchhaspel",              "th",         2, "left", "G3", "hinten oben"),
  item("das", "Halligan-Tool",          "Multifunktions-Einbruchswerkzeug",            "th",         1, "left", "G3", "Innenwand"),
  item("die", "Brechstange",            "Nageleisen 800 mm",                           "th",         1, "left", "G3", "Innenwand"),
  item("der", "Bolzenschneider",        "Schwerer Bolzenschneider 900 mm",             "th",         1, "left", "G3", "Innenwand"),
  item("die", "Feuerwehraxt",           "Holzaxt mit Spalthammer",                     "th",         1, "left", "G3", "Innenwand"),

  // G4 — Absturzsicherung & Leinen
  item("das", "Absturzsicherungsset",   "Komplettsatz Absturzsicherung",               "hoehenrettung", 2, "left", "G4", "Kiste oben", "grüne Kiste"),
  item("der", "Auffanggurt",            "Auffanggurt für Feuerwehreinsatz",            "hoehenrettung", 2, "left", "G4", "Kiste oben", "grüne Kiste"),
  item("der", "Karabinersatz",          "Satz Verschlusskarabiner",                    "hoehenrettung", 1, "left", "G4", "Kiste oben", "grüne Kiste"),
  item("die", "Bandschlinge",           "Rund- und Bandschlingen",                     "hoehenrettung", 1, "left", "G4", "Kiste oben", "grüne Kiste"),
  item("die", "Feuerwehrleine",         "30 m Feuerwehrleine mit Beutel",              "hoehenrettung", 1, "left", "G4", "oben links"),
  item("die", "Arbeitsleine",           "20 m Arbeitsleine",                           "hoehenrettung", 1, "left", "G4", "oben mitte"),
  item("die", "Ventilleine",            "Kurze Ventilleine",                           "hoehenrettung", 1, "left", "G4", "oben rechts"),

  // G5 — Wasserentnahme & Schläuche
  item("der", "B-Druckschlauch",        "20 m formstabiler B-Druckschlauch",           "wasser",     1, "right", "G5", "Schlauchpaket oben"),
  item("der", "C-Druckschlauch",        "15 m formstabiler C-Druckschlauch",           "wasser",     1, "right", "G5", "Schlauchpaket mitte"),
  item("der", "D-Druckschlauch",        "5 m D-Druckschlauch für Klein­anwendungen",  "wasser",     1, "right", "G5", "Schlauchpaket unten"),
  item("der", "Saugschlauch",           "A-Saugschlauch 110 mm, 1,6 m",                "wasser",     2, "right", "G5", "Auszug oben"),
  item("der", "Saugkorb",               "Saugkorb mit Rückschlagklappe",               "wasser",     1, "right", "G5", "mitte"),
  item("das", "Standrohr",              "Standrohr 2B für Überflurhydranten",          "wasser",     1, "right", "G5", "unten"),
  item("der", "Überflurhydrantenschlüssel", "Schlüssel für Überflurhydranten",         "wasser",     1, "right", "G5", "Werkzeugleiste"),
  item("der", "Unterflurhydrantenschlüssel", "Hakenschlüssel für Unterflurhydranten",  "wasser",     1, "right", "G5", "Werkzeugleiste"),
  item("der", "Kupplungsschlüssel",     "ABC-Kupplungsschlüssel",                      "wasser",     1, "right", "G5", "Werkzeugleiste"),

  // G6 — Armaturen & Strahlrohre
  item("das", "C-Mehrzweckstrahlrohr",  "C-Strahlrohr mit Sprühstrahl",                "armaturen",  1, "right", "G6", "oben links"),
  item("das", "B-Mehrzweckstrahlrohr",  "B-Strahlrohr mit Sprühstrahl",                "armaturen",  1, "right", "G6", "oben rechts"),
  item("das", "Hohlstrahlrohr C",       "Hohlstrahlrohr C 100–400 l/min",              "armaturen",  2, "right", "G6", "mitte links"),
  item("das", "Hohlstrahlrohr B",       "Hohlstrahlrohr B 200–800 l/min",              "armaturen",  2, "right", "G6", "mitte rechts"),
  item("das", "Schaumstrahlrohr",       "Schwerschaum-Strahlrohr S2",                  "armaturen",  2, "right", "G6", "unten links"),
  item("der", "Zumischer Z2",           "Schaumzumischer Z2",                          "armaturen",  2, "right", "G6", "Halterung oben"),
  item("der", "Zumischer Z4",           "Schaumzumischer Z4",                          "armaturen",  2, "right", "G6", "Halterung oben"),
  item("der", "Stützkrümmer",           "Stützkrümmer B-Druck",                        "armaturen",  1, "right", "G6", "Halterung mitte"),
  item("das", "Verteilerstück",         "Verteiler B-CBC",                             "armaturen",  1, "right", "G6", "oben mitte"),
  item("das", "Sammelstück",            "Sammelstück A-2B",                            "armaturen",  1, "right", "G6", "unten mitte"),
  item("das", "Druckbegrenzungsventil", "Druckbegrenzungsventil 10 bar",               "armaturen",  2, "right", "G6", "seitlich"),

  // G7 — Schaummittel & Feuerlöscher
  item("der", "Schaummittelbehälter",   "20 L Schaummittel Mehrbereichsschaum",        "loeschmittel", 1, "right", "G7", "Boden"),
  item("der", "Pulverlöscher",          "Feuerlöscher PG12 (12 kg Pulver)",            "loeschmittel", 1, "right", "G7", "Halterung links"),
  item("der", "CO2-Löscher",            "Feuerlöscher 5 kg Kohlendioxid",              "loeschmittel", 1, "right", "G7", "Halterung mitte"),
  item("der", "Wasserlöscher",          "Wasserfeuerlöscher 9 L",                      "loeschmittel", 1, "right", "G7", "Halterung rechts"),
  item("die", "Kübelspritze",           "Tragbare Kübelspritze mit 10 L",              "loeschmittel", 1, "right", "G7", "oben"),

  // G8 — Werkzeug & Bergung
  item("der", "Werkzeugkasten",         "Großer Werkzeugkasten Mechanik",              "werkzeug",   1, "right", "G8", "oben mitte"),
  item("der", "Mehrzweckzug",           "Greifzug / Handseilzug 1,6 t",                "bergung",    2, "right", "G8", "unten rechts", "orange Kiste"),
  item("die", "Seilwinde",              "Motorseilwinde zum Ziehen schwerer Lasten",   "bergung",    2, "right", "G8", "unten rechts", "orange Kiste"),
  item("die", "Umlenkrolle",            "Umlenkrolle für Greifzug",                    "bergung",    1, "right", "G8", "unten rechts", "orange Kiste"),
  item("die", "Motorkettensäge",        "Kettensäge mit Schnittschutzausrüstung",      "werkzeug",   2, "right", "G8", "Halterung hinten"),
  item("der", "Trennschleifer",         "Benzin-Trennschleifer mit Diamantscheibe",    "werkzeug",   2, "right", "G8", "Halterung vorne"),
  item("die", "Säbelsäge",              "Akku-Säbelsäge",                              "werkzeug",   1, "right", "G8", "Schublade oben"),
  item("die", "Akku-Bohrmaschine",      "Akku-Schlagbohrmaschine 18 V",                "werkzeug",   1, "right", "G8", "Schublade oben"),
  item("die", "Schaufel",               "Klappbare Feuerwehrschaufel",                 "werkzeug",   1, "right", "G8", "Außenwand"),
  item("der", "Spaten",                 "Stabiler Spaten",                             "werkzeug",   1, "right", "G8", "Außenwand"),
  item("der", "Besen",                  "Straßenbesen",                                "werkzeug",   1, "right", "G8", "Außenwand"),
  item("der", "Einreißhaken",           "Einreißhaken 2,5 m",                          "werkzeug",   1, "right", "G8", "Außenwand"),

  // G9 — Gefahrgut & Umweltschutz
  item("das", "Ölbindemittel",          "Sack Ölbindemittel Typ III",                  "gefahrgut",  1, "right", "G9", "unten links"),
  item("das", "Bindevlies",             "Ölbindendes Vlies auf Rolle",                 "gefahrgut",  1, "right", "G9", "unten rechts"),
  item("die", "Auffangwanne klein",     "Faltauffangwanne 30 L",                       "gefahrgut",  1, "right", "G9", "Boden links"),
  item("die", "Auffangwanne groß",      "Faltauffangwanne 200 L",                      "gefahrgut",  2, "right", "G9", "Boden rechts"),
  item("das", "Leckdichtkissen",        "Pneumatisches Leckdichtkissen",               "gefahrgut",  2, "right", "G9", "Kiste oben", "blaue Kiste"),
  item("der", "Chemikalienschutzanzug", "CSA Form 3 mit Stiefeln",                     "gefahrgut",  3, "right", "G9", "Haken links"),
  item("der", "Hitzeschutzanzug",       "Hitzeschutzanzug Form 2",                     "gefahrgut",  3, "right", "G9", "Haken rechts"),
  item("das", "CO-Warngerät",           "Kohlenmonoxid-Warngerät",                     "messtechnik",2, "right", "G9", "Halterung oben"),
  item("das", "Ex-Warngerät",           "Ex-Mehrgasmessgerät",                         "messtechnik",2, "right", "G9", "Halterung oben"),
  item("der", "Auffangtrichter",        "Faltbarer Auffangtrichter",                   "gefahrgut",  1, "right", "G9", "Boden mitte"),
  item("die", "Tauchpumpe",             "Schmutzwasser-Tauchpumpe TP 4/1",             "wasser",     2, "right", "G9", "Boden hinten"),

  // Heck / Pumpenstand (back)
  item("die", "Feuerlöschkreiselpumpe", "FPN 10-2000 Heckpumpe",                       "pumpe",      3, "back", "Heck", "Pumpenstand mittig"),
  item("der", "Schnellangriffsschlauch","Formstabiler Schlauch an Haspel, 30 m",       "wasser",     1, "back", "Heck", "Haspel oben"),
  item("die", "Warnblitzleuchte",       "Satz Warnblitzleuchten 4 Stück",              "absicherung",1, "back", "Heck", "Kiste oben", "gelbe Kiste"),
  item("der", "Verkehrsleitkegel",      "Satz Pylonen 8 Stück",                        "absicherung",1, "back", "Heck", "Kiste oben", "gelbe Kiste"),
  item("das", "Warndreieck",            "Warndreieck zur Absicherung",                 "absicherung",1, "back", "Heck", "Kiste oben", "gelbe Kiste"),
  item("der", "Überdrucklüfter",        "Benzin-Überdrucklüfter",                      "belueftung", 2, "back", "Heck", "Halterung rechts"),

  // Mannschaftsraum (back)
  item("der", "Sanitätskoffer",         "Notfallkoffer nach DIN 14142",                "sanitaet",   1, "back", "MR", "unter Sitz links"),
  item("die", "Krankentrage",           "Klapptrage Modell SAM",                       "sanitaet",   2, "back", "MR", "Deckenhalterung"),
  item("der", "Defibrillator",          "Automatisierter externer Defibrillator AED",  "sanitaet",   1, "back", "MR", "Halterung Rückwand"),
  item("die", "Wolldecke",              "Wolldecke zum Wärmeerhalt",                   "sanitaet",   1, "back", "MR", "Staufach hinten"),
  item("das", "Rettungstuch",           "Rettungstuch mit Griffen",                    "sanitaet",   1, "back", "MR", "Staufach hinten"),
  item("die", "Sauerstoffflasche",      "2 L Medizinische Sauerstoffflasche",          "sanitaet",   2, "back", "MR", "Tasche Rückwand"),
  item("das", "Handfunkgerät",          "Digitales HRT Tetra-Funkgerät",               "funk",       1, "back", "MR", "Ladeschale links"),
  item("das", "Megafon",                "Akku-Megafon",                                "funk",       1, "back", "MR", "Halterung Rückwand"),
  item("die", "Wärmebildkamera",        "Wärmebildkamera für Atemschutztrupp",         "messtechnik",2, "back", "MR", "Halterung vorne"),
  item("die", "Signalpfeife",           "Notsignalpfeife am Band",                     "funk",       1, "back", "MR", "Halterung links"),

  // Dach (top / GR)
  item("die", "Steckleiter",            "4-teilige Steckleiter",                       "leitern",    1, "top", "GR", "Dach rechts"),
  item("die", "Schiebleiter",           "3-teilige Schiebleiter",                      "leitern",    2, "top", "GR", "Dach links"),
  item("die", "Klappleiter",            "Klappleiter 2 m",                             "leitern",    1, "top", "GR", "Dach mitte"),
  item("die", "Hakenleiter",            "Hakenleiter für Dachrettung",                 "leitern",    2, "top", "GR", "Dach mitte hinten"),
  item("das", "Sprungpolster",          "Sprungpolster SP16",                          "leitern",    3, "top", "GR", "Dach hinten"),
];
