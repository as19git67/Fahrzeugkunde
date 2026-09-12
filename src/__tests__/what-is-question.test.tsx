// @vitest-environment jsdom
/**
 * Komponententest für "Was ist das?": Nach einer falschen Antwort muss neben
 * der richtigen Option (grün) auch die eigene Fehlwahl (rot) sichtbar sein.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Ohne Vitest-Globals räumt Testing Library nicht automatisch auf – das
// vorherige Render bliebe im DOM und die Rollen-Queries fänden Duplikate.
afterEach(cleanup);
import { WhatIsQuestion } from "@/components/game/WhatIsQuestion";
import type { Question } from "@/app/api/questions/route";

const question: Question = {
  id: "q_0_1",
  type: "what_is",
  item: {
    id: 1,
    name: "Seilwinde",
    article: "die",
    plural: false,
    imagePath: null,
    locationImagePath: null,
    locationLabel: null,
    positionId: null,
    boxId: null,
  },
  options: [
    { id: 1, name: "Seilwinde", article: "die" },
    { id: 2, name: "Tauchpumpe", article: "die" },
    { id: 3, name: "Saugkorb", article: "der" },
    { id: 4, name: "Standrohr", article: "das" },
  ],
};

describe("WhatIsQuestion", () => {
  it("markiert nach einer falschen Antwort die Fehlwahl rot und die richtige grün", () => {
    const onAnswer = vi.fn();
    render(<WhatIsQuestion question={question} onAnswer={onAnswer} answered={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Tauchpumpe/ }));
    expect(onAnswer).toHaveBeenCalledWith(false);

    expect(screen.getByRole("button", { name: /Tauchpumpe/ }).className).toMatch(/bg-red-700/);
    expect(screen.getByRole("button", { name: /Seilwinde/ }).className).toMatch(/bg-green-600/);
    expect(screen.getByRole("button", { name: /Saugkorb/ }).className).toMatch(/bg-zinc-700/);
  });

  it("markiert nach einer richtigen Antwort nur die richtige Option", () => {
    const onAnswer = vi.fn();
    render(<WhatIsQuestion question={question} onAnswer={onAnswer} answered={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Seilwinde/ }));
    expect(onAnswer).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: /Seilwinde/ }).className).toMatch(/bg-green-600/);
    expect(document.querySelectorAll(".bg-red-700")).toHaveLength(0);
  });

  it("nimmt nur eine Antwort an – weitere Klicks werden ignoriert", () => {
    const onAnswer = vi.fn();
    render(<WhatIsQuestion question={question} onAnswer={onAnswer} answered={false} />);

    fireEvent.click(screen.getByRole("button", { name: /Tauchpumpe/ }));
    fireEvent.click(screen.getByRole("button", { name: /Saugkorb/ }));
    fireEvent.click(screen.getByRole("button", { name: /Seilwinde/ }));
    expect(onAnswer).toHaveBeenCalledTimes(1);
    for (const btn of screen.getAllByRole("button")) expect(btn.hasAttribute("disabled")).toBe(true);
  });
});
