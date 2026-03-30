"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Question } from "@/app/api/questions/route";
import { calculateScore } from "@/lib/scoring";

export type GameMode = "time_attack" | "speed_run";
export type GamePhase = "idle" | "playing" | "answer_feedback" | "finished";

export const TIME_ATTACK_DURATION = 60; // Sekunden
export const SPEED_RUN_TARGET = 20;     // Anzahl richtiger Antworten

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
  timeLeft: number;           // time_attack: Sekunden verbleibend
  startTime: number | null;   // Unix ms
  questionStartTime: number | null;
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
  finished: false,
};

export function useGame() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startGame = useCallback(
    (questions: Question[], mode: GameMode) => {
      stopTimer();
      const now = Date.now();
      setState({
        ...INITIAL_STATE,
        phase: "playing",
        mode,
        questions,
        timeLeft: mode === "time_attack" ? TIME_ATTACK_DURATION : 0,
        startTime: now,
        questionStartTime: now,
      });
    },
    [stopTimer]
  );

  // Timer-Tick für time_attack
  useEffect(() => {
    if (state.phase !== "playing" || state.mode !== "time_attack") return;
    stopTimer();
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.timeLeft <= 1) {
          stopTimer();
          return { ...prev, timeLeft: 0, phase: "finished", finished: true };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return stopTimer;
  }, [state.phase, state.mode, stopTimer]);

  const answerQuestion = useCallback(
    (correct: boolean) => {
      setState((prev) => {
        if (prev.phase !== "playing") return prev;

        const elapsed = Date.now() - (prev.questionStartTime ?? Date.now());
        const currentItem = prev.questions[prev.currentIndex];
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

        // Speed-Run: fertig wenn 20 korrekte Antworten
        const speedRunDone =
          prev.mode === "speed_run" && newCorrect >= SPEED_RUN_TARGET;

        return {
          ...prev,
          phase: "answer_feedback",
          score: newScore,
          correctAnswers: newCorrect,
          totalAnswers: newTotal,
          streak: newStreak,
          lastScoreDelta: result.total,
          finished: speedRunDone,
        };
      });
    },
    []
  );

  const nextQuestion = useCallback(() => {
    setState((prev) => {
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
    stopTimer();
    setState(INITIAL_STATE);
  }, [stopTimer]);

  const currentQuestion = state.questions[state.currentIndex] ?? null;
  const elapsedSeconds = state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0;

  return { state, currentQuestion, elapsedSeconds, startGame, answerQuestion, nextQuestion, resetGame };
}
