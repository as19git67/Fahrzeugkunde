/**
 * Kodierung des Aufbewahrungsorts im Gegenstands-Formular.
 *
 * Das <select> kann nur einen String halten, ein Ziel ist aber entweder eine
 * Position oder eine Kiste (die ihre Position kennt). Beide Richtungen –
 * Item → Auswahlwert und Auswahlwert → positionId/boxId – müssen dieselbe
 * Kodierung verwenden. Vorher standen sich "position:<id>" (Optionen) und
 * "pos:<id>" (Vorbelegung und Auflösung) gegenüber: Das Formular öffnete für
 * verortete Gegenstände mit „— keine —" und setzte den Ort beim Speichern
 * still auf null.
 */

export type TargetKind = "position" | "box";

export interface LocationTarget {
  kind: TargetKind;
  id: number;
  positionId: number;
  boxId: number | null;
  label: string;
}

export interface ItemPlacement {
  positionId: number | null;
  boxId: number | null;
}

/** Auswahlwert für ein Ziel; "" steht für „nicht verortet". */
export function targetKey(kind: TargetKind, id: number): string {
  return `${kind}:${id}`;
}

/** Auswahlwert, der die aktuelle Verortung eines Gegenstands beschreibt. */
export function targetKeyForItem(item: Partial<ItemPlacement> | null | undefined): string {
  if (item?.boxId) return targetKey("box", item.boxId);
  if (item?.positionId) return targetKey("position", item.positionId);
  return "";
}

/**
 * Löst einen Auswahlwert gegen die bekannten Ziele auf.
 * "" → unverortet; unbekannter Wert (Ziel inzwischen gelöscht) → null.
 */
export function resolveTargetKey(
  key: string,
  targets: readonly LocationTarget[]
): ItemPlacement | null {
  if (key === "") return { positionId: null, boxId: null };
  const target = targets.find((t) => targetKey(t.kind, t.id) === key);
  if (!target) return null;
  return { positionId: target.positionId, boxId: target.boxId };
}
