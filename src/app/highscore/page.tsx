"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { calculateSpeedRunResult } from "@/lib/scoring";
import { formatSeconds } from "@/lib/format";

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

// Die Modi werden unterschiedlich gewertet (Punkte vs. Zeit) und deshalb
// nur getrennt angezeigt – eine gemischte Liste wäre nicht vergleichbar.
const MODES = [
  { key: "time_attack", label: "⏱ Time Attack", hint: "Punkte in 60 Sekunden" },
  { key: "speed_run", label: "🚀 Speed Run", hint: "Zeit für 20 richtige Antworten (+5 s je Fehler)" },
] as const;

export default function HighscorePage() {
  const [entries, setEntries] = useState<HighscoreEntry[]>([]);
  const [mode, setMode] = useState<string>("time_attack");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/highscores?limit=20&mode=${mode}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Highscores konnten nicht geladen werden (${r.status})`);
        return r.json();
      })
      .then((data) => { if (!cancelled) setEntries(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Fehler"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode]);

  const current = MODES.find((m) => m.key === mode) ?? MODES[0];

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
        <div className="flex gap-2 mb-2" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={mode === m.key}
              onClick={() => {
                if (m.key === mode) return;
                setLoading(true);
                setError(null);
                setMode(m.key);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                mode === m.key
                  ? "bg-red-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 mb-6">{current.hint}</p>

        {loading ? (
          <div className="text-center text-zinc-500 py-12">Lade...</div>
        ) : error ? (
          <div className="text-center text-red-400 py-12">{error}</div>
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
            {entries.map((entry, i) => {
              const speedRun = entry.mode === "speed_run" ? calculateSpeedRunResult(entry) : null;
              return (
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
                      {speedRun
                        ? `${formatSeconds(entry.durationSeconds)} gespielt` +
                          (speedRun.wrongAnswers > 0 ? ` · ${speedRun.wrongAnswers} Fehler (+${speedRun.penaltySeconds} s)` : " · fehlerfrei")
                        : `${entry.correctAnswers}/${entry.totalAnswers} richtig`}
                      {" · "}
                      {new Date(entry.createdAt).toLocaleDateString("de-DE")}
                    </div>
                  </div>

                  {/* Wertung: Punkte bzw. gewertete Zeit */}
                  <div className="text-right">
                    <div className="text-xl font-black text-yellow-400 tabular-nums">
                      {speedRun ? formatSeconds(speedRun.effectiveSeconds) : entry.score}
                    </div>
                    {speedRun && (
                      <div className="text-[10px] text-zinc-500">{entry.score} Pkt.</div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
