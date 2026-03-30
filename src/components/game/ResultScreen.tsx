"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { GameMode } from "@/hooks/useGame";

interface Result {
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  durationSeconds: number;
  mode: GameMode;
}

interface Props {
  result: Result;
  vehicleId: number;
  handle: string | null;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function ResultScreen({ result, vehicleId, handle, onPlayAgain, onHome }: Props) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const accuracy = result.totalAnswers > 0
    ? Math.round((result.correctAnswers / result.totalAnswers) * 100)
    : 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/highscores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: result.score,
          mode: result.mode,
          correctAnswers: result.correctAnswers,
          totalAnswers: result.totalAnswers,
          durationSeconds: result.durationSeconds,
          vehicleId,
          handle: handle ?? "Anonym",
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-6 py-8 max-w-md mx-auto"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", delay: 0.2 }}
        className="text-7xl"
      >
        {accuracy >= 80 ? "🏆" : accuracy >= 50 ? "👍" : "💪"}
      </motion.div>

      <div className="text-center">
        <h2 className="text-3xl font-black text-white">
          {result.mode === "time_attack" ? "Zeit abgelaufen!" : "Ziel erreicht!"}
        </h2>
        {handle && <p className="text-zinc-400 mt-1">Gut gemacht, {handle}!</p>}
      </div>

      <div className="grid grid-cols-2 gap-4 w-full">
        <StatCard label="Punkte" value={result.score.toString()} color="text-yellow-400" />
        <StatCard label="Genauigkeit" value={`${accuracy}%`} color="text-green-400" />
        <StatCard label="Richtig" value={`${result.correctAnswers}/${result.totalAnswers}`} color="text-blue-400" />
        <StatCard
          label={result.mode === "time_attack" ? "Zeit" : "Dauer"}
          value={`${result.durationSeconds}s`}
          color="text-purple-400"
        />
      </div>

      <div className="flex flex-col gap-3 w-full">
        {!saved && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-700 text-black font-bold py-3 rounded-xl transition-colors"
          >
            {saving ? "Speichere..." : "🏆 Score speichern"}
          </button>
        )}
        {saved && (
          <div className="text-center text-green-400 font-semibold py-2">
            ✓ Score gespeichert!
          </div>
        )}
        <button
          onClick={onPlayAgain}
          className="bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Nochmal spielen
        </button>
        <button
          onClick={onHome}
          className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Zur Startseite
        </button>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 text-center">
      <div className={`text-3xl font-black ${color}`}>{value}</div>
      <div className="text-zinc-400 text-sm mt-1">{label}</div>
    </div>
  );
}
