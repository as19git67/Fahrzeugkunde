import { NextRequest, NextResponse } from "next/server";
import { db, items, vehicleViews, compartments, positions, boxes } from "@/db";
import { eq, inArray } from "drizzle-orm";
import { createLocationLabeler } from "@/lib/location-label";

export type QuestionType = "where_is" | "what_is" | "where_in_vehicle";

export interface Question {
  id: string;
  type: QuestionType;
  item: {
    id: number;
    name: string;
    article: string | null;
    // Bild des Gegenstands — wird in "Was ist das?" gefragt und in den
    // Ortsfragen gezeigt, damit klar ist, welcher Gegenstand gemeint ist.
    imagePath: string | null;
    // Bild der Aufbewahrungsstelle — erst nach der Antwort als Auflösung.
    locationImagePath: string | null;
    // Aufbewahrungsort als Text, abgeleitet aus der Fahrzeugstruktur
    // (Fach, Position, ggf. Kiste). `null`, wenn das Item unverortet ist.
    locationLabel: string | null;
    positionId: number | null;
    boxId: number | null;
  };
  // what_is: 4 Item-Optionen (Name), richtige = item.id
  options?: Array<{ id: number; name: string; article: string | null }>;
  // where_is: bis zu 4 Ortsoptionen, richtige = item.locationLabel
  locationOptions?: Array<{ label: string; correct: boolean }>;
  // where_in_vehicle: Navigation durch Views/Compartments/Positions/Boxes (Box optional)
  navigationTarget?: {
    viewId: number;
    compartmentId: number;
    positionId: number;
    boxId: number | null;
  };
}

type ItemRow = typeof items.$inferSelect;

/**
 * Item-Zeile plus der aus der Fahrzeugstruktur abgeleitete Ortstext. Der Ort
 * ist kein gespeichertes Feld mehr, wird aber an so vielen Stellen gebraucht,
 * dass er einmal pro Anfrage vorberechnet wird.
 */
interface LocatedItem {
  row: ItemRow;
  locationLabel: string | null;
}

/** Reduziert eine Item-Zeile auf die Felder, die der Client für Fragen braucht. */
function toQuestionItem({ row, locationLabel }: LocatedItem): Question["item"] {
  return {
    id: row.id,
    name: row.name,
    article: row.article,
    imagePath: row.imagePath,
    locationImagePath: row.locationImagePath,
    locationLabel,
    positionId: row.positionId,
    boxId: row.boxId,
  };
}

/** Lädt Ansichten, Fächer, Positionen und Kisten eines Fahrzeugs. */
async function loadStructure(vehicleId: number) {
  const views = await db
    .select()
    .from(vehicleViews)
    .where(eq(vehicleViews.vehicleId, vehicleId));

  const viewIds = views.map((v) => v.id);
  const comps = viewIds.length
    ? await db.select().from(compartments).where(inArray(compartments.viewId, viewIds))
    : [];

  const compIds = comps.map((c) => c.id);
  const poss = compIds.length
    ? await db.select().from(positions).where(inArray(positions.compartmentId, compIds))
    : [];

  const posIds = poss.map((p) => p.id);
  const bxs = posIds.length
    ? await db.select().from(boxes).where(inArray(boxes.positionId, posIds))
    : [];

  return { views, compartments: comps, positions: poss, boxes: bxs };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vehicleId = parseInt(searchParams.get("vehicleId") || "0");
  const count = Math.min(parseInt(searchParams.get("count") || "10"), 50);

  if (!vehicleId) return NextResponse.json({ error: "vehicleId erforderlich" }, { status: 400 });

  // Alle Items mit Bild laden
  const allItems = await db.select().from(items).where(eq(items.vehicleId, vehicleId));

  if (allItems.length < 4) {
    return NextResponse.json(
      { error: "Mindestens 4 Items mit Bildern benötigt" },
      { status: 422 }
    );
  }

  // Fahrzeugstruktur einmal komplett laden: Daraus entstehen sowohl die
  // Ortstexte der "Wo ist …?"-Optionen als auch die Navigationsziele.
  const structure = await loadStructure(vehicleId);
  const labelFor = createLocationLabeler(structure);
  const compartmentById = new Map(structure.compartments.map((c) => [c.id, c]));
  const positionById = new Map(structure.positions.map((p) => [p.id, p]));
  const boxById = new Map(structure.boxes.map((b) => [b.id, b]));

  const locatedItems: LocatedItem[] = allItems.map((row) => ({
    row,
    locationLabel: labelFor(row.positionId, row.boxId),
  }));

  const itemsWithImage = locatedItems.filter((i) => i.row.imagePath);
  const itemsWithLocation = locatedItems.filter((i) => i.locationLabel);
  const itemsWithPosition = locatedItems.filter((i) => i.row.positionId || i.row.boxId);

  // Welche Fragetypen sind möglich? "Wo ist …?" braucht mindestens zwei
  // unterschiedliche Orte, sonst gäbe es keinen Distraktor zur richtigen
  // Antwort und die Frage wäre trivial.
  const distinctLocations = new Set(itemsWithLocation.map((i) => i.locationLabel));
  const canWhatIs = itemsWithImage.length >= 4;
  const canWhereIs = distinctLocations.size >= 2;
  const canWhereInVehicle = itemsWithPosition.length > 0;

  if (!canWhatIs && !canWhereIs && !canWhereInVehicle) {
    return NextResponse.json(
      { error: "Zu wenig Daten für Fragen. Bitte mehr Items mit Ort oder Bild anlegen." },
      { status: 422 }
    );
  }

  const enabledTypes: QuestionType[] = [];
  if (canWhatIs) enabledTypes.push("what_is");
  if (canWhereIs) enabledTypes.push("where_is");
  if (canWhereInVehicle) enabledTypes.push("where_in_vehicle");

  const questions: Question[] = [];

  for (let i = 0; i < count; i++) {
    const type = enabledTypes[Math.floor(Math.random() * enabledTypes.length)];

    if (type === "what_is") {
      const pool = shuffle(itemsWithImage);
      const target = pool[0];
      const distractors = pool.slice(1, 4);
      const options = shuffle([
        { id: target.row.id, name: target.row.name, article: target.row.article },
        ...distractors.map((d) => ({ id: d.row.id, name: d.row.name, article: d.row.article })),
      ]);
      questions.push({
        id: `q_${i}_${target.row.id}`,
        type: "what_is",
        item: toQuestionItem(target),
        options,
      });
    } else if (type === "where_is") {
      const pool = shuffle(itemsWithLocation);
      const target = pool[0];
      // Bis zu 3 falsche Orte als Distraktoren. Mehrere Items können an
      // derselben Stelle liegen — deshalb über die Orte deduplizieren, sonst
      // stünde derselbe Text mehrfach zur Auswahl.
      const distractors = shuffle(
        [...distinctLocations].filter((label) => label !== target.locationLabel)
      ).slice(0, 3);
      const locationOptions = shuffle([
        { label: target.locationLabel!, correct: true },
        ...distractors.map((label) => ({ label: label!, correct: false })),
      ]);
      questions.push({
        id: `q_${i}_${target.row.id}`,
        type: "where_is",
        item: toQuestionItem(target),
        locationOptions,
      });
    } else {
      // where_in_vehicle
      const pool = shuffle(itemsWithPosition);
      const target = pool[0];
      const q: Question = {
        id: `q_${i}_${target.row.id}`,
        type: "where_in_vehicle",
        item: toQuestionItem(target),
      };
      // Position herleiten: entweder direkt am Item oder über die Kiste.
      const box = target.row.boxId ? boxById.get(target.row.boxId) : undefined;
      const positionId = box ? box.positionId : target.row.positionId;
      const pos = positionId ? positionById.get(positionId) : undefined;
      const comp = pos ? compartmentById.get(pos.compartmentId) : undefined;
      if (pos && comp) {
        q.navigationTarget = {
          viewId: comp.viewId,
          compartmentId: comp.id,
          positionId: pos.id,
          boxId: target.row.boxId ?? null,
        };
      }
      questions.push(q);
    }
  }

  return NextResponse.json(questions);
}
