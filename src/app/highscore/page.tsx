"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

interface HighscoreEntry {
  id: number;
  handle: string;
  score: number;
  mode: string;
  correctAnswers: number;
  totalAnswers: number;
  durationSeconds: number;
  createdAt: string;
}

const MODE_LABELS: Record<string, string> = {
  time_attack: "⏱ Time Attack",
  speed_run: "🚀 Speed Run",
};

export default function HighscorePage() {
  const [entries, setEntries] = useState<HighscoreEntry[]>([]);
  const [mode, setMode] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const url = mode === "all" ? "/api/highscores?limit=20" : `/api/highscores?limit=20&mode=${mode}`;
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [mode]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          <span>←</span>
          <span className="text-sm">Startseite</span>
        </Link>
        <h1 className="font-black text-lg">🏆 Highscore</h1>
        <div />
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Mode Filter */}
        <div className="flex gap-2 mb-6">
          {["all", "time_attack", "speed_run"].map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                mode === m
                  ? "bg-red-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
              }`}
            >
              {m === "all" ? "Alle" : MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center text-zinc-500 py-12">Lade...</div>
        ) : entries.length === 0 ? (
          <div className="text-center text-zinc-500 py-12">
            <div className="text-5xl mb-4">🏆</div>
            <p>Noch keine Einträge. Sei der Erste!</p>
            <Link href="/" className="mt-4 inline-block text-red-500 hover:underline">
              Jetzt spielen
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-4 px-4 py-3 rounded-2xl border ${
                  i === 0
                    ? "bg-yellow-500/10 border-yellow-500/30"
                    : i === 1
                    ? "bg-zinc-400/10 border-zinc-400/30"
                    : i === 2
                    ? "bg-orange-500/10 border-orange-500/30"
                    : "bg-zinc-900 border-zinc-800"
                }`}
              >
                {/* Rang */}
                <div className="w-8 text-center font-black text-lg">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                </div>

                {/* Handle */}
                <div className="flex-1">
                  <div className="font-bold text-white">{entry.handle}</div>
                  <div className="text-xs text-zinc-500">
                    {MODE_LABELS[entry.mode] ?? entry.mode} ·{" "}
                    {entry.correctAnswers}/{entry.totalAnswers} richtig ·{" "}
                    {entry.durationSeconds}s ·{" "}
                    {new Date(entry.createdAt).toLocaleDateString("de-CH")}
                  </div>
                </div>

                {/* Score */}
                <div className="text-xl font-black text-yellow-400">{entry.score}</div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
