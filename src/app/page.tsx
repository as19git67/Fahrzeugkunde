"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LoginModal } from "@/components/ui/LoginModal";
import { useAuth } from "@/hooks/useAuth";

interface Vehicle {
  id: number;
  name: string;
  description: string | null;
}

export default function Home() {
  const { user, loading, refetch, logout } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    fetch("/api/vehicles").then((r) => r.json()).then(setVehicles).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🚒</span>
          <div>
            <h1 className="text-lg font-black tracking-tight">Fahrzeugkunde</h1>
            <p className="text-xs text-zinc-500">Feuerwehr Lernspiel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {!loading && (
            user ? (
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 text-sm">
                  👤 <span className="text-white font-semibold">{user.handle}</span>
                </span>
                <button
                  onClick={logout}
                  className="text-zinc-500 hover:text-white text-sm transition-colors"
                >
                  Abmelden
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                className="bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
              >
                Anmelden
              </button>
            )
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl sm:text-5xl font-black mb-4">
            Wo ist die{" "}
            <span className="text-red-500">Seilwinde</span>?
          </h2>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Lerne spielerisch, wo welche Ausrüstung im Feuerwehrauto verstaut ist.
            Schnell + korrekt = hoher Score.
          </p>
        </motion.div>

        {/* Fahrzeuge */}
        {vehicles.length > 0 ? (
          <div className="mb-12">
            <h3 className="text-lg font-bold text-zinc-300 mb-4">Fahrzeuge</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {vehicles.map((v, i) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link href={`/play/${v.id}`}>
                    <div className="bg-zinc-900 border border-zinc-800 hover:border-red-500/50 rounded-2xl p-6 transition-all group cursor-pointer">
                      <div className="text-4xl mb-3">🚒</div>
                      <h4 className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">
                        {v.name}
                      </h4>
                      {v.description && (
                        <p className="text-zinc-500 text-sm mt-1">{v.description}</p>
                      )}
                      <div className="mt-4 flex items-center gap-1 text-red-500 text-sm font-semibold">
                        Spielen
                        <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 text-zinc-600"
          >
            <div className="text-6xl mb-4">🚒</div>
            <p className="text-lg">Noch keine Fahrzeuge angelegt.</p>
            <p className="text-sm mt-2">
              Gehe zum{" "}
              <Link href="/creator" className="text-red-500 hover:underline">
                Creator-Modus
              </Link>{" "}
              um ein Fahrzeug hinzuzufügen.
            </p>
          </motion.div>
        )}

        {/* Nav-Links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <NavCard
            href="/highscore"
            icon="🏆"
            title="Highscore"
            desc="Die besten Spieler im Überblick"
          />
          <NavCard
            href="/creator"
            icon="🛠️"
            title="Creator"
            desc="Fahrzeug und Beladung anlegen"
          />
          <div
            onClick={() => !user && setShowLogin(true)}
            className="cursor-pointer"
          >
            {user ? (
              <NavCard
                href="/play"
                icon="🎮"
                title="Spielen"
                desc="Wähle ein Fahrzeug und leg los"
              />
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-5 transition-all">
                <div className="text-3xl mb-2">👤</div>
                <h4 className="font-bold text-white">Anmelden</h4>
                <p className="text-zinc-500 text-sm mt-1">Für den Highscore einloggen</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showLogin && (
        <LoginModal
          onSuccess={() => { setShowLogin(false); refetch(); }}
          onClose={() => setShowLogin(false)}
        />
      )}
    </div>
  );
}

function NavCard({ href, icon, title, desc }: { href: string; icon: string; title: string; desc: string }) {
  return (
    <Link href={href}>
      <div className="bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-2xl p-5 transition-all group cursor-pointer">
        <div className="text-3xl mb-2">{icon}</div>
        <h4 className="font-bold text-white group-hover:text-red-400 transition-colors">{title}</h4>
        <p className="text-zinc-500 text-sm mt-1">{desc}</p>
      </div>
    </Link>
  );
}
