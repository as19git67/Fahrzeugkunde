// @vitest-environment jsdom
/**
 * Komponententest für das Gegenstands-Formular im Creator: Der
 * Aufbewahrungsort muss beim Öffnen vorbelegt sein und beim Speichern als
 * positionId/boxId im Request landen.
 *
 * Regression: Das Formular öffnete für verortete Gegenstände mit „— keine —"
 * und schickte beim Speichern positionId/boxId = null – der Ort ging verloren.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { ItemForm } from "@/components/creator/VehicleEditor";
import type { LocationTarget } from "@/lib/item-target";

afterEach(cleanup);

const targets: LocationTarget[] = [
  { kind: "position", id: 7, positionId: 7, boxId: null, label: "Links → G1 → oben" },
  { kind: "box", id: 3, positionId: 7, boxId: 3, label: "Links → G1 → oben → 📦 rot" },
  { kind: "position", id: 8, positionId: 8, boxId: null, label: "Links → G1 → unten" },
];

const item = {
  id: 42,
  name: "Rettungsschere",
  article: "die",
  plural: false,
  imagePath: null,
  locationImagePath: null,
  difficulty: 2,
  positionId: 7 as number | null,
  boxId: null as number | null,
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("alert", vi.fn());
});

function lastBody(): Record<string, unknown> {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  expect(url).toBe("/api/items/42");
  expect(init.method).toBe("PATCH");
  return JSON.parse(init.body as string);
}

function renderForm(current: typeof item | null) {
  const onSave = vi.fn();
  render(
    <ItemForm
      vehicleId={1}
      item={current}
      targets={targets}
      onSave={onSave}
      onCancel={() => {}}
      onDelete={() => {}}
    />
  );
  return { onSave, select: screen.getByLabelText("Aufbewahrungsort") as HTMLSelectElement };
}

describe("ItemForm – Aufbewahrungsort", () => {
  it("belegt die Auswahl mit der Position des Gegenstands vor", () => {
    const { select } = renderForm(item);
    expect(select.value).toBe("position:7");
    expect(select.selectedOptions[0].textContent).toBe("Links → G1 → oben");
  });

  it("belegt die Auswahl mit der Kiste vor, wenn der Gegenstand in einer liegt", () => {
    const { select } = renderForm({ ...item, boxId: 3 });
    expect(select.value).toBe("box:3");
  });

  it("behält den Ort, wenn ohne Änderung gespeichert wird", async () => {
    const { onSave } = renderForm(item);
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({ positionId: 7, boxId: null });
  });

  it("speichert eine neu gewählte Position als positionId ohne Kiste", async () => {
    const { onSave, select } = renderForm(item);
    fireEvent.change(select, { target: { value: "position:8" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({ positionId: 8, boxId: null });
  });

  it("speichert eine gewählte Kiste als boxId plus deren Position", async () => {
    const { onSave, select } = renderForm(item);
    fireEvent.change(select, { target: { value: "box:3" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({ positionId: 7, boxId: 3 });
  });

  it("'— keine —' entortet den Gegenstand bewusst", async () => {
    const { onSave, select } = renderForm(item);
    fireEvent.change(select, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(lastBody()).toMatchObject({ positionId: null, boxId: null });
  });

  it("neuer Gegenstand: Auswahl leer, gewählter Ort wird per POST gesendet", async () => {
    const { onSave, select } = renderForm(null);
    expect(select.value).toBe("");
    fireEvent.change(screen.getByPlaceholderText("Seilwinde"), { target: { value: "Kübelspritze" } });
    fireEvent.change(select, { target: { value: "position:8" } });
    fireEvent.click(screen.getByRole("button", { name: "Hinzufügen" }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe("/api/items");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      vehicleId: 1,
      name: "Kübelspritze",
      positionId: 8,
      boxId: null,
    });
  });
});
