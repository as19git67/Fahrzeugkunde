/**
 * Ableitung des Aufbewahrungsorts als Text aus der Fahrzeugstruktur.
 *
 * Ein Gegenstand ist über `positionId` bzw. `boxId` in der Hierarchie
 * Ansicht → Fach → Position → (Kiste) verortet. Der Klartext dazu — "G1,
 * unten rechts, orange Kiste" — wurde früher als eigenes Feld `location_label`
 * von Hand gepflegt und konnte dadurch der tatsächlichen Verortung
 * widersprechen. Er wird jetzt aus genau denselben Labels erzeugt, aus denen
 * auch die Navigation besteht.
 *
 * Der Text ist die Antwortoption des Fragetyps "Wo ist …?" — sowohl für die
 * richtige Antwort als auch für die Distraktoren. Er muss deshalb innerhalb
 * eines Fahrzeugs eindeutig auf eine Stelle zeigen: Trägt mehr als ein Fach
 * dasselbe Label (z. B. je ein "Fach 1" links und rechts), wird die Ansicht
 * vorangestellt, sonst bliebe für Spielende offen, welche Stelle gemeint ist.
 */

export interface LocationStructure {
  views: Array<{ id: number; label: string }>;
  compartments: Array<{ id: number; viewId: number; label: string }>;
  positions: Array<{ id: number; compartmentId: number; label: string }>;
  boxes: Array<{ id: number; positionId: number; label: string }>;
}

/** Liefert den Ortstext zu einer Position/Kiste, oder `null` wenn unverortet. */
export type LocationLabeler = (
  positionId: number | null | undefined,
  boxId?: number | null
) => string | null;

export function createLocationLabeler(structure: LocationStructure): LocationLabeler {
  const views = new Map(structure.views.map((v) => [v.id, v]));
  const compartments = new Map(structure.compartments.map((c) => [c.id, c]));
  const positions = new Map(structure.positions.map((p) => [p.id, p]));
  const boxes = new Map(structure.boxes.map((b) => [b.id, b]));

  // Fach-Labels, die mehrfach im Fahrzeug vorkommen, brauchen die Ansicht
  // davor, damit der Ortstext eindeutig bleibt.
  const labelCounts = new Map<string, number>();
  for (const c of structure.compartments) {
    labelCounts.set(c.label, (labelCounts.get(c.label) ?? 0) + 1);
  }

  return (positionId, boxId) => {
    // Die Kiste kennt ihre Position — ein Item braucht daher nicht beides.
    const box = boxId ? boxes.get(boxId) : undefined;
    const resolvedPositionId = box ? box.positionId : positionId;
    if (!resolvedPositionId) return null;

    const position = positions.get(resolvedPositionId);
    if (!position) return null;
    const compartment = compartments.get(position.compartmentId);
    if (!compartment) return null;

    const parts: string[] = [];
    if ((labelCounts.get(compartment.label) ?? 0) > 1) {
      const view = views.get(compartment.viewId);
      if (view) parts.push(view.label);
    }
    parts.push(compartment.label, position.label);
    if (box) parts.push(box.label);

    return parts.join(", ");
  };
}
