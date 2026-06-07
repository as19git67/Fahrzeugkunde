// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useGame,
  TIME_ATTACK_DURATION,
  SPEED_RUN_TARGET,
} from "@/hooks/useGame";
import type { Question } from "@/app/api/questions/route";

// Minimale, typgültige Mock-Fragen. Der Hook bewertet Antworten über das
// boolean-Argument von answerQuestion, nicht über den Frageninhalt – daher
// reichen schlanke Platzhalter.
function makeQuestions(n: number): Question[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    type: "what_is" as const,
    item: {
      id: i + 1,
      name: `Item ${i + 1}`,
      article: null,
      imagePath: null,
      locationLabel: null,
      positionId: null,
      boxId: null,
    },
    options: [],
  }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useGame – Spieldurchlauf", () => {
  it("startet im idle-Zustand ohne aktuelle Frage", () => {
    const { result } = renderHook(() => useGame());
    expect(result.current.state.phase).toBe("idle");
    expect(result.current.currentQuestion).toBeNull();
  });

  it("startGame versetzt ins Spiel und zeigt die erste Frage", () => {
    const { result } = renderHook(() => useGame());
    const questions = makeQuestions(3);
    act(() => result.current.startGame(questions, "speed_run"));
    expect(result.current.state.phase).toBe("playing");
    expect(result.current.currentQuestion?.id).toBe("q0");
  });

  it("speed_run: 20 richtige Antworten spielen das Spiel komplett durch", () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.startGame(makeQuestions(5), "speed_run"));

    for (let i = 0; i < SPEED_RUN_TARGET; i++) {
      act(() => result.current.answerQuestion(true));
      expect(result.current.state.phase).toBe("answer_feedback");
      act(() => result.current.nextQuestion());
    }

    expect(result.current.state.correctAnswers).toBe(SPEED_RUN_TARGET);
    expect(result.current.state.totalAnswers).toBe(SPEED_RUN_TARGET);
    expect(result.current.state.finished).toBe(true);
    expect(result.current.state.phase).toBe("finished");
    expect(result.current.state.score).toBeGreaterThan(0);
  });

  it("recycelt die Fragen über die Liste hinaus", () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.startGame(makeQuestions(3), "time_attack"));
    expect(result.current.currentQuestion?.id).toBe("q0");

    // Drei Runden weiter → Index läuft modulo Listenlänge wieder auf q0
    for (let i = 0; i < 3; i++) {
      act(() => result.current.answerQuestion(true));
      act(() => result.current.nextQuestion());
    }
    expect(result.current.state.currentIndex).toBe(0);
    expect(result.current.currentQuestion?.id).toBe("q0");
  });

  it("falsche Antwort setzt die Streak zurück und Score bleibt >= 0", () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.startGame(makeQuestions(3), "speed_run"));

    // Erst eine richtige Antwort (Streak hoch), dann eine falsche
    act(() => result.current.answerQuestion(true));
    act(() => result.current.nextQuestion());
    expect(result.current.state.streak).toBe(1);

    act(() => result.current.answerQuestion(false));
    expect(result.current.state.streak).toBe(0);
    expect(result.current.state.correctAnswers).toBe(1);
    expect(result.current.state.totalAnswers).toBe(2);
    expect(result.current.state.score).toBeGreaterThanOrEqual(0);
  });

  it("time_attack: Timer läuft ab und beendet das Spiel", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useGame());
    act(() => result.current.startGame(makeQuestions(3), "time_attack"));
    expect(result.current.state.timeLeft).toBe(TIME_ATTACK_DURATION);

    act(() => {
      vi.advanceTimersByTime(TIME_ATTACK_DURATION * 1000);
    });

    expect(result.current.state.timeLeft).toBe(0);
    expect(result.current.state.phase).toBe("finished");
    expect(result.current.state.finished).toBe(true);
  });

  it("resetGame stellt den Ausgangszustand wieder her", () => {
    const { result } = renderHook(() => useGame());
    act(() => result.current.startGame(makeQuestions(3), "speed_run"));
    act(() => result.current.answerQuestion(true));
    act(() => result.current.resetGame());
    expect(result.current.state.phase).toBe("idle");
    expect(result.current.state.score).toBe(0);
    expect(result.current.state.totalAnswers).toBe(0);
    expect(result.current.currentQuestion).toBeNull();
  });
});
