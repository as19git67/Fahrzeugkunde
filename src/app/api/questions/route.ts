import { NextRequest, NextResponse } from "next/server";
import { db, items, vehicleViews, compartments, positions } from "@/db";
import { eq } from "drizzle-orm";

export type QuestionType = "where_is" | "what_is" | "where_in_vehicle";

export interface Question {
  id: string;
  type: QuestionType;
  item: {
    id: number;
    name: string;
    imagePath: string | null;
    locationLabel: string | null;
    positionId: number | null;
  };
  // what_is: 4 Item-Optionen (Name), richtige = item.id
  options?: Array<{ id: number; name: string }>;
  // where_is: 4 Ortsoptionen (locationLabel), richtige = item.locationLabel
  locationOptions?: Array<{ label: string; correct: boolean }>;
  // where_in_vehicle: Navigation durch Views/Compartments/Positions
  navigationTarget?: {
    viewId: number;
    compartmentId: number;
    positionId: number;
  };
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

  const itemsWithImage = allItems.filter((i) => i.imagePath);
  const itemsWithLocation = allItems.filter((i) => i.locationLabel);
  const itemsWithPosition = allItems.filter((i) => i.positionId);

  // Welche Fragetypen sind möglich?
  const canWhatIs = itemsWithImage.length >= 4;
  const canWhereIs = itemsWithLocation.length >= 4; // braucht 4 verschiedene Orte für Optionen
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
        { id: target.id, name: target.name },
        ...distractors.map((d) => ({ id: d.id, name: d.name })),
      ]);
      questions.push({
        id: `q_${i}_${target.id}`,
        type: "what_is",
        item: {
          id: target.id,
          name: target.name,
          imagePath: target.imagePath,
          locationLabel: target.locationLabel,
          positionId: target.positionId,
        },
        options,
      });
    } else if (type === "where_is") {
      const pool = shuffle(itemsWithLocation);
      const target = pool[0];
      // 3 falsche Orte als Distraktoren
      const distractors = shuffle(
        itemsWithLocation.filter((it) => it.locationLabel !== target.locationLabel)
      ).slice(0, 3);
      const locationOptions = shuffle([
        { label: target.locationLabel!, correct: true },
        ...distractors.map((d) => ({ label: d.locationLabel!, correct: false })),
      ]);
      questions.push({
        id: `q_${i}_${target.id}`,
        type: "where_is",
        item: {
          id: target.id,
          name: target.name,
          imagePath: target.imagePath,
          locationLabel: target.locationLabel,
          positionId: target.positionId,
        },
        locationOptions,
      });
    } else {
      // where_in_vehicle
      const pool = shuffle(itemsWithPosition);
      const target = pool[0];
      const q: Question = {
        id: `q_${i}_${target.id}`,
        type: "where_in_vehicle",
        item: {
          id: target.id,
          name: target.name,
          imagePath: target.imagePath,
          locationLabel: target.locationLabel,
          positionId: target.positionId,
        },
      };
      if (target.positionId) {
        const pos = await db.select().from(positions).where(eq(positions.id, target.positionId)).get();
        if (pos) {
          const comp = await db.select().from(compartments).where(eq(compartments.id, pos.compartmentId)).get();
          if (comp) {
            q.navigationTarget = { viewId: comp.viewId, compartmentId: comp.id, positionId: pos.id };
          }
        }
      }
      questions.push(q);
    }
  }

  return NextResponse.json(questions);
}
