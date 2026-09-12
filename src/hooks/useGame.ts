"use client";

import { useState, useCallback, useEffect } from "react";
import type { Question } from "@/app/api/questions/route";
import { calculateScore, SPEED_RUN_TARGET, TIME_ATTACK_DURATION } from "@/lib/scoring";

export { SPEED_RUN_TARGET, TIME_ATTACK_DURATION };

export type GameMode = "time_attack" | "speed_run";
export type GamePhase = "idle" | "playing" | "answer_feedback" | "finished";

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  questions: Question[];
  currentIndex: number;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  streak: number;
  lastScoreDelta: number | null;
  timeLeft: number;               // time_attack: Sekunden verbleibend
  startTime: number | null;       // Unix ms
  questionStartTime: number | null;
  /** time_attack: Zeitpunkt (Unix ms), an dem das Spiel endet – die Uhr
   *  wird daraus berechnet und läuft auch während des Antwort-Feedbacks. */
  deadline: number | null;
  /** Seit Spielstart vergangene Sekunden (tickt, bis das Ziel erreicht ist). */
  elapsedSeconds: number;
  /** Tatsächliche Spieldauer in Sekunden, gesetzt sobald das Spiel beendet ist. */
  durationSeconds: number | null;
  finished: boolean;
}

const INITIAL_STATE: GameState = {
  phase: "idle",
  mode: "time_attack",
  questions: [],
  currentIndex: 0,
  score: 0,
  correctAnswers: 0,
  totalAnswers: 0,
  streak: 0,
  lastScoreDelta: null,
  timeLeft: TIME_ATTACK_DURATION,
  startTime: null,
  questionStartTime: null,
  deadline: null,
  elapsedSeconds: 0,
  durationSeconds: null,
  finished: false,
};

// Kurzer Tick, damit die Uhr ohne sichtbare Verzögerung umspringt. Die Zeit
// selbst kommt aus `deadline`/`startTime`, nicht aus dem Zählen der Ticks –
// dadurch geht beim Phasenwechsel keine angebrochene Sekunde verloren.
const TICK_MS = 250;

function elapsedSince(start: number | null, now: number): number {
  return start ? Math.floor((now - start) / 1000) : 0;
}

function remainingSeconds(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function finishState(prev: GameState, now: number): GameState {
  const elapsed = prev.startTime ? Math.round((now - prev.startTime) / 1000) : 0;
  return {
    ...prev,
    phase: "finished",
    finished: true,
    timeLeft: 0,
    elapsedSeconds: elapsed,
    durationSeconds: prev.mode === "time_attack" ? Math.min(elapsed, TIME_ATTACK_DURATION) : elapsed,
  };
}

export function useGame() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);

  const startGame = useCallback((questions: Question[], mode: GameMode) => {
    const now = Date.now();
    setState({
      ...INITIAL_STATE,
      phase: "playing",
      mode,
      questions,
      timeLeft: mode === "time_attack" ? TIME_ATTACK_DURATION : 0,
      startTime: now,
      questionStartTime: now,
      deadline: mode === "time_attack" ? now + TIME_ATTACK_DURATION * 1000 : null,
    });
  }, []);

  // Uhr: läuft vom Spielstart bis zum Ende – auch während des Feedbacks.
  const running = state.phase === "playing" || state.phase === "answer_feedback";
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setState((prev) => {
        if (prev.phase !== "playing" && prev.phase !== "answer_feedback") return prev;
        const now = Date.now();
        // Time-Attack: Deadline erreicht → Spiel ist vorbei, egal in welcher Phase
        if (prev.deadline !== null && now >= prev.deadline) return finishState(prev, now);
        // Speed-Run: Ziel bereits erreicht → Dauer steht fest, nicht weiterzählen
        if (prev.finished) return prev;
        const elapsedSeconds = elapsedSince(prev.startTime, now);
        const timeLeft = prev.deadline !== null ? remainingSeconds(prev.deadline, now) : 0;
        if (elapsedSeconds === prev.elapsedSeconds && timeLeft === prev.timeLeft) return prev;
        return { ...prev, elapsedSeconds, timeLeft };
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [running]);

  const answerQuestion = useCallback((correct: boolean) => {
    setState((prev) => {
      if (prev.phase !== "playing") return prev;

      const now = Date.now();
      const elapsed = now - (prev.questionStartTime ?? now);
      const result = calculateScore({
        correct,
        elapsedMs: elapsed,
        difficulty: 1,
        streak: prev.streak,
      });

      const newStreak = correct ? prev.streak + 1 : 0;
      const newCorrect = prev.correctAnswers + (correct ? 1 : 0);
      const newTotal = prev.totalAnswers + 1;
      const newScore = Math.max(0, prev.score + result.total);

      // Speed-Run: fertig, sobald das Ziel erreicht ist. Die Dauer wird hier
      // fixiert – das Feedback danach zählt nicht mehr mit.
      const speedRunDone = prev.mode === "speed_run" && newCorrect >= SPEED_RUN_TARGET;
      const duration = Math.round((now - (prev.startTime ?? now)) / 1000);

      return {
        ...prev,
        phase: "answer_feedback",
        score: newScore,
        correctAnswers: newCorrect,
        totalAnswers: newTotal,
        streak: newStreak,
        lastScoreDelta: result.total,
        finished: speedRunDone,
        elapsedSeconds: speedRunDone ? duration : prev.elapsedSeconds,
        durationSeconds: speedRunDone ? duration : prev.durationSeconds,
      };
    });
  }, []);

  const nextQuestion = useCallback(() => {
    setState((prev) => {
      if (prev.phase === "finished") return prev;
      if (prev.finished) return { ...prev, phase: "finished" };

      const nextIndex = prev.currentIndex + 1;
      // Questions recyceln wenn zu wenige
      const nextI = nextIndex % prev.questions.length;

      return {
        ...prev,
        phase: "playing",
        currentIndex: nextI,
        lastScoreDelta: null,
        questionStartTime: Date.now(),
      };
    });
  }, []);

  const resetGame = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const currentQuestion = state.questions[state.currentIndex] ?? null;

  return {
    state,
    currentQuestion,
    elapsedSeconds: state.elapsedSeconds,
    startGame,
    answerQuestion,
    nextQuestion,
    resetGame,
  };
}
