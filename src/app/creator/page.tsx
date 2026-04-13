"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { LoginModal } from "@/components/ui/LoginModal";
import { VehicleEditor } from "@/components/creator/VehicleEditor";

interface Vehicle {
  id: number;
  name: string;
  description: string | null;
}

export default function CreatorPage() {
  const { user, loading, refetch } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const loadVehicles = async () => {
    const res = await fetch("/api/vehicles");
    const data = await res.json();
    setVehicles(data);
  };

  useEffect(() => { loadVehicles(); }, []);

  const handleResetSeed = async () => {
    const ok = window.confirm(
      "Datenbank wirklich zurücksetzen und neu seeden?\n\n" +
      "Alle angelegten Fahrzeuge und Highscores gehen dabei verloren."
    );
    if (!ok) return;
    setResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch("/api/admin/reset-seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unbekannter Fehler");
      setResetMessage(`✅ DB zurückgesetzt – HLF 20 mit ${data.itemCount} Gegenständen angelegt.`);
      setSelectedVehicle(null);
      await loadVehicles();
    } catch (err) {
      setResetMessage("❌ " + (err instanceof Error ? err.message : "Fehler beim Zurücksetzen"));
    } finally {
      setResetting(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      const v = await res.json();
      await loadVehicles();
      setNewName("");
      setNewDesc("");
      setSelectedVehicle(v.id);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center gap-6 p-4">
        <div className="text-6xl">🛠️</div>
        <h2 className="text-2xl font-bold">Creator-Modus</h2>
        <p className="text-zinc-400 text-center max-w-sm">
          Zum Erstellen und Bearbeiten von Fahrzeugen musst du eingeloggt sein.
        </p>
        <button
          onClick={() => setShowLogin(true)}
          className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-xl transition-colors"
        >
          Jetzt anmelden
        </button>
        <Link href="/" className="text-zinc-500 hover:text-white text-sm transition-colors">
          ← Zurück zur Startseite
        </Link>
        {showLogin && (
          <LoginModal
            onSuccess={() => { setShowLogin(false); refetch(); }}
            onClose={() => setShowLogin(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          <span>←</span>
          <span className="text-sm">Startseite</span>
        </Link>
        <h1 className="font-black text-lg">🛠️ Creator</h1>
        <span className="text-zinc-500 text-sm">👤 {user.handle}</span>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {selectedVehicle ? (
          <VehicleEditor
            vehicleId={selectedVehicle}
            onBack={() => setSelectedVehicle(null)}
          />
        ) : (
          <div className="flex flex-col gap-8">
            {/* DB zurücksetzen + Seed laden */}
            <div className="bg-zinc-900 border border-yellow-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div>
                <h2 className="text-lg font-bold text-yellow-300 mb-1">
                  ⚠️ Datenbank zurücksetzen
                </h2>
                <p className="text-sm text-zinc-400">
                  Löscht alle Fahrzeuge, Beladungen und Highscores und legt ein
                  leeres HLF 20 als Ausgangspunkt an.
                </p>
                {resetMessage && (
                  <p className="text-sm mt-2 text-zinc-300">{resetMessage}</p>
                )}
              </div>
              <button
                onClick={handleResetSeed}
                disabled={resetting}
                className="bg-yellow-500 hover:bg-yellow-400 disabled:bg-zinc-700 disabled:text-zinc-400 text-black font-bold px-5 py-3 rounded-xl transition-colors whitespace-nowrap"
              >
                {resetting ? "Setze zurück..." : "DB zurücksetzen & seeden"}
              </button>
            </div>

            {/* Neues Fahrzeug */}
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
              <h2 className="text-lg font-bold mb-4">Neues Fahrzeug anlegen</h2>
              <form onSubmit={handleCreate} className="flex flex-col gap-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="z.B. LF 20"
                  required
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:border-red-400 outline-none"
                />
                <input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Beschreibung (optional)"
                  className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-white placeholder-zinc-500 focus:border-red-400 outline-none"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 text-white font-bold py-2 rounded-xl transition-colors self-start px-6"
                >
                  {creating ? "Erstelle..." : "+ Erstellen"}
                </button>
              </form>
            </div>

            {/* Bestehende Fahrzeuge */}
            {vehicles.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-4">Bestehende Fahrzeuge</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {vehicles.map((v) => (
                    <motion.button
                      key={v.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedVehicle(v.id)}
                      className="bg-zinc-900 border border-zinc-800 hover:border-red-500/50 rounded-2xl p-5 text-left transition-all"
                    >
                      <div className="text-3xl mb-2">🚒</div>
                      <div className="font-bold text-white">{v.name}</div>
                      {v.description && (
                        <div className="text-zinc-500 text-sm mt-1">{v.description}</div>
                      )}
                      <div className="text-red-500 text-sm mt-3 font-semibold">Bearbeiten →</div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
