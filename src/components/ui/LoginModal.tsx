"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onSuccess: () => void;
  onClose: () => void;
}

export function LoginModal({ onSuccess, onClose }: Props) {
  const [step, setStep] = useState<"form" | "code">("form");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Fehler");
        return;
      }
      setUserId(data.userId);
      setStep("code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ungültiger Code");
        return;
      }
      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">
            {step === "form" ? "Anmelden / Registrieren" : "Code eingeben"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl leading-none">×</button>
        </div>

        <AnimatePresence mode="wait">
          {step === "form" ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handleSendCode}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="text-zinc-400 text-sm mb-1 block">Dein Handle (Anzeigename)</label>
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="FireMax"
                  required
                  pattern="[a-zA-Z0-9_\-]{3,20}"
                  title="3-20 Zeichen, nur Buchstaben, Zahlen, _ und -"
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:border-red-400 outline-none"
                />
              </div>
              <div>
                <label className="text-zinc-400 text-sm mb-1 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="max@feuerwehr.de"
                  required
                  className="w-full bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:border-red-400 outline-none"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {loading ? "Sende Code..." : "Code senden"}
              </button>
              <p className="text-zinc-500 text-xs text-center">
                Kein Passwort nötig. Wir senden dir einen einmaligen Code.
              </p>
            </motion.form>
          ) : (
            <motion.form
              key="code"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleVerify}
              className="flex flex-col gap-4"
            >
              <p className="text-zinc-400 text-sm">
                Wir haben einen 6-stelligen Code an <strong className="text-white">{email}</strong> gesendet.
              </p>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                required
                className="w-full bg-zinc-800 border border-zinc-600 rounded-xl px-4 py-3 text-white text-center text-3xl tracking-widest font-mono focus:border-red-400 outline-none"
              />
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {loading ? "Prüfe..." : "Einloggen"}
              </button>
              <button
                type="button"
                onClick={() => setStep("form")}
                className="text-zinc-400 hover:text-white text-sm"
              >
                ← Zurück
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
