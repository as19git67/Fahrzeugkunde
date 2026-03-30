"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGame, GameMode, TIME_ATTACK_DURATION, SPEED_RUN_TARGET } from "@/hooks/useGame";
import { WhatIsQuestion } from "./WhatIsQuestion";
import { WhereIsQuestion } from "./WhereIsQuestion";
import { ScorePopup } from "@/components/ui/ScorePopup";
import { StreakBadge } from "@/components/ui/StreakBadge";
import type { Question } from "@/app/api/questions/route";

interface Props {
  vehicleId: number;
  vehicleName: string;
  vehicleData: Parameters<typeof WhereIsQuestion>[0]["vehicle"];
  onFinished: (result: { score: number; correctAnswers: number; totalAnswers: number; durationSeconds: number; mode: GameMode }) => void;
}

export function GameScreen({ vehicleId, vehicleName, vehicleData, onFinished }: Props) {
  const { state, currentQuestion, elapsedSeconds, startGame, answerQuestion, nextQuestion, resetGame } = useGame();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mode, setMode] = useState<GameMode>("time_attack");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [selectedMode, setSelectedMode] = useState(false);
  const finishedRef = useRef(false);

  // Auto-next nach Feedback
  useEffect(() => {
    if (state.phase === "answer_feedback") {
      setAnswered(true);
      const timer = setTimeout(() => {
        setAnswered(false);
        nextQuestion();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [state.phase, nextQuestion]);

  // Finished
  useEffect(() => {
    if (state.phase === "finished" && !finishedRef.current) {
      finishedRef.current = true;
      const duration =
        mode === "time_attack"
          ? TIME_ATTACK_DURATION
          : elapsedSeconds;
      onFinished({
        score: state.score,
        correctAnswers: state.correctAnswers,
        totalAnswers: state.totalAnswers,
        durationSeconds: duration,
        mode,
      });
    }
  }, [state.phase]);

  const handleStart = async (selectedMode: GameMode) => {
    setMode(selectedMode);
    setLoading(true);
    setLoadError(null);
    finishedRef.current = false;
    try {
      const res = await fetch(`/api/questions?vehicleId=${vehicleId}&count=40`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) {
        setLoadError(data?.error ?? "Fragen konnten nicht geladen werden.");
        return;
      }
      if (data.length === 0) {
        setLoadError("Keine Fragen verfügbar. Bitte zuerst Beladung im Creator anlegen.");
        return;
      }
      setQuestions(data);
      startGame(data, selectedMode);
      setSelectedMode(true);
    } catch {
      setLoadError("Verbindungsfehler beim Laden der Fragen.");
    } finally {
      setLoading(false);
    }
  };

  // Modus-Auswahl
  if (!selectedMode || state.phase === "idle") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-8 py-12"
      >
        <div className="text-center">
          <h2 className="text-3xl font-black text-white mb-2">{vehicleName}</h2>
          <p className="text-zinc-400">Wähle deinen Spielmodus</p>
        </div>
        {loadError && (
          <div className="bg-red-900/40 border border-red-500/50 text-red-300 rounded-xl px-4 py-3 text-sm max-w-md text-center">
            {loadError}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-md">
          <ModeCard
            title="⏱ Time Attack"
            desc={`Möglichst viele richtige Antworten in ${TIME_ATTACK_DURATION} Sekunden`}
            color="from-red-600 to-orange-600"
            onClick={() => handleStart("time_attack")}
            loading={loading}
          />
          <ModeCard
            title="🚀 Speed Run"
            desc={`${SPEED_RUN_TARGET} richtige Antworten so schnell wie möglich`}
            color="from-blue-600 to-purple-600"
            onClick={() => handleStart("speed_run")}
            loading={loading}
          />
        </div>
      </motion.div>
    );
  }

  if (state.phase === "finished") {
    return null; // Parent übernimmt
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-xl mx-auto">
      {/* Header: Timer + Score */}
      <div className="flex items-center justify-between bg-zinc-900 rounded-2xl px-4 py-3 relative">
        <div className="flex flex-col">
          <span className="text-xs text-zinc-400 uppercase tracking-wider">Punkte</span>
          <motion.span
            key={state.score}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            className="text-2xl font-black text-white"
          >
            {state.score}
          </motion.span>
        </div>

        <div className="flex flex-col items-center">
          {mode === "time_attack" ? (
            <>
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Zeit</span>
              <span
                className={`text-2xl font-black ${state.timeLeft <= 10 ? "text-red-400 animate-pulse" : "text-white"}`}
              >
                {state.timeLeft}s
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-zinc-400 uppercase tracking-wider">Richtig</span>
              <span className="text-2xl font-black text-white">
                {state.correctAnswers}/{SPEED_RUN_TARGET}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-1">
          <StreakBadge streak={state.streak} />
          <span className="text-xs text-zinc-500">{state.totalAnswers} Fragen</span>
        </div>

        <ScorePopup delta={state.phase === "answer_feedback" ? state.lastScoreDelta : null} />
      </div>

      {/* Progress bar für time_attack */}
      {mode === "time_attack" && (
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-red-500 rounded-full"
            initial={{ width: "100%" }}
            animate={{ width: `${(state.timeLeft / TIME_ATTACK_DURATION) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Progress bar für speed_run */}
      {mode === "speed_run" && (
        <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            animate={{ width: `${(state.correctAnswers / SPEED_RUN_TARGET) * 100}%` }}
          />
        </div>
      )}

      {/* Frage */}
      <AnimatePresence mode="wait">
        {currentQuestion && (
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }}
            className="bg-zinc-900 rounded-2xl p-6"
          >
            {currentQuestion.type === "what_is" ? (
              <WhatIsQuestion
                question={currentQuestion}
                onAnswer={answerQuestion}
                answered={answered}
                wasCorrect={state.phase === "answer_feedback" ? (state.lastScoreDelta ?? 0) > 0 : null}
              />
            ) : (
              <WhereIsQuestion
                question={currentQuestion}
                vehicle={vehicleData}
                onAnswer={answerQuestion}
                answered={answered}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeCard({
  title,
  desc,
  color,
  onClick,
  loading,
}: {
  title: string;
  desc: string;
  color: string;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      disabled={loading}
      className={`bg-gradient-to-br ${color} p-6 rounded-2xl text-left text-white shadow-lg disabled:opacity-50`}
    >
      <div className="text-2xl font-black mb-2">{title}</div>
      <div className="text-sm opacity-90">{desc}</div>
    </motion.button>
  );
}
