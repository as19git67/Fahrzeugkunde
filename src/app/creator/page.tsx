"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
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
  const isAdmin = user?.role === "admin";
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const loadVehicles = async () => {
    // cache: "no-store" verhindert, dass der Browser/Dev-Server die
    // Fahrzeugliste nach einem Rename/Delete aus einem stale Cache liefert
    // ("Leiche mit altem Namen").
    const res = await fetch("/api/vehicles", { cache: "no-store" });
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

  const handleRenameSubmit = async (id: number) => {
    const name = renameValue.trim();
    if (!name) return;
    const res = await fetch(`/api/vehicles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      await loadVehicles();
      setRenamingId(null);
      setRenameValue("");
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Umbenennen fehlgeschlagen: ${data.error ?? res.statusText}`);
    }
  };

  const handleExportVehicle = async (v: Vehicle) => {
    setExportingId(v.id);
    try {
      const res = await fetch(`/api/admin/vehicles/${v.id}/export`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Export fehlgeschlagen (${res.status})`);
      }
      // Dateiname aus Content-Disposition übernehmen – der Server liefert
      // einen kollisionsfreien Namen mit Timestamp.
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `vehicle-${v.id}.fzk`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Export fehlgeschlagen");
    } finally {
      setExportingId(null);
    }
  };

  const handleImportFile = async (file: File) => {
    setImporting(true);
    setImportMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/vehicles/import", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? `Import fehlgeschlagen (${res.status})`);
      }
      setImportMessage(
        `✅ "${data.vehicleName}" importiert (${data.assetsWritten} Bilder übernommen).`
      );
      await loadVehicles();
      setSelectedVehicle(data.vehicleId);
    } catch (err) {
      setImportMessage("❌ " + (err instanceof Error ? err.message : "Fehler beim Import"));
    } finally {
      setImporting(false);
      if (importInputRef.current) importInputRef.current.value = "";
    }
  };

  const handleDeleteVehicle = async (v: Vehicle) => {
    const ok = window.confirm(
      `Fahrzeug "${v.name}" wirklich löschen?\n\n` +
      "Alle Ansichten, Fächer, Positionen, Kisten und Ausrüstungsgegenstände " +
      "werden ebenfalls gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
    );
    if (!ok) return;
    const res = await fetch(`/api/vehicles/${v.id}`, { method: "DELETE" });
    if (res.ok) {
      await loadVehicles();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Löschen fehlgeschlagen: ${data.error ?? res.statusText}`);
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
            onBack={async () => {
              // Liste neu laden, damit Umbenennungen im Editor direkt
              // sichtbar werden und keine "Leiche" mit altem Namen bleibt.
              setSelectedVehicle(null);
              await loadVehicles();
            }}
            onDeleted={async () => {
              setSelectedVehicle(null);
              await loadVehicles();
            }}
          />
        ) : (
          <div className="flex flex-col gap-8">
            {/* DB zurücksetzen + Seed laden — nur für Administratoren sichtbar */}
            {isAdmin && (
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
            )}

            {/* Fahrzeug importieren (.fzk-Paket) — nur für Administratoren sichtbar */}
            {isAdmin && (
              <div className="bg-zinc-900 border border-blue-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-blue-300 mb-1">
                    📦 Fahrzeug-Paket importieren
                  </h2>
                  <p className="text-sm text-zinc-400">
                    Liest eine zuvor exportierte <code>.fzk</code>-Datei (Struktur
                    + Bilder) ein und legt daraus ein neues Fahrzeug an. Bestehende
                    Fahrzeuge bleiben unverändert.
                  </p>
                  {importMessage && (
                    <p className="text-sm mt-2 text-zinc-300">{importMessage}</p>
                  )}
                </div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".fzk,.zip,application/zip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                  }}
                />
                <button
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing}
                  className="bg-blue-500 hover:bg-blue-400 disabled:bg-zinc-700 disabled:text-zinc-400 text-white font-bold px-5 py-3 rounded-xl transition-colors whitespace-nowrap"
                >
                  {importing ? "Importiere..." : "Datei auswählen"}
                </button>
              </div>
            )}

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
                    <div
                      key={v.id}
                      className="bg-zinc-900 border border-zinc-800 hover:border-red-500/50 rounded-2xl p-5 flex flex-col gap-2 transition-all"
                    >
                      <div className="text-3xl">🚒</div>
                      {renamingId === v.id ? (
                        <form
                          onSubmit={(e) => { e.preventDefault(); handleRenameSubmit(v.id); }}
                          className="flex flex-col gap-2"
                        >
                          <input
                            type="text"
                            autoFocus
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-white text-sm outline-none focus:border-red-400"
                          />
                          <div className="flex gap-2">
                            <button
                              type="submit"
                              className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-lg"
                            >
                              Speichern
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRenamingId(null); setRenameValue(""); }}
                              className="text-zinc-400 hover:text-white text-xs px-2"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="font-bold text-white">{v.name}</div>
                          {v.description && (
                            <div className="text-zinc-500 text-sm">{v.description}</div>
                          )}
                        </>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setSelectedVehicle(v.id)}
                          className="text-red-500 text-sm font-semibold hover:text-red-400"
                        >
                          Bearbeiten →
                        </motion.button>
                        <div className="flex gap-1">
                          {isAdmin && (
                            <button
                              onClick={() => handleExportVehicle(v)}
                              disabled={exportingId === v.id}
                              title="Als .fzk-Paket exportieren"
                              className="text-zinc-500 hover:text-blue-300 disabled:text-zinc-700 p-1 rounded transition-colors"
                            >
                              {exportingId === v.id ? "⏳" : "📦"}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setRenamingId(v.id);
                              setRenameValue(v.name);
                            }}
                            title="Umbenennen"
                            className="text-zinc-500 hover:text-white p-1 rounded transition-colors"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDeleteVehicle(v)}
                            title="Löschen"
                            className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
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
