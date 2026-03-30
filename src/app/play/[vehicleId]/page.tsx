"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { GameScreen } from "@/components/game/GameScreen";
import { ResultScreen } from "@/components/game/ResultScreen";
import { useAuth } from "@/hooks/useAuth";
import type { GameMode } from "@/hooks/useGame";

interface VehicleData {
  id: number;
  name: string;
  description: string | null;
  views: Array<{
    id: number;
    side: string;
    label: string;
    imagePath: string | null;
    compartments: Array<{
      id: number;
      label: string;
      imagePath: string | null;
      hotspotX: number | null;
      hotspotY: number | null;
      hotspotW: number | null;
      hotspotH: number | null;
      positions: Array<{
        id: number;
        label: string;
        hotspotX: number | null;
        hotspotY: number | null;
        hotspotW: number | null;
        hotspotH: number | null;
      }>;
    }>;
  }>;
}

interface GameResult {
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  durationSeconds: number;
  mode: GameMode;
}

export default function PlayPage() {
  const { vehicleId } = useParams<{ vehicleId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<GameResult | null>(null);
  const [gameKey, setGameKey] = useState(0);

  useEffect(() => {
    fetch(`/api/vehicles/${vehicleId}`)
      .then((r) => r.json())
      .then(setVehicle)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [vehicleId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-lg">Lade Fahrzeug...</div>
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <div className="text-zinc-400 text-lg">Fahrzeug nicht gefunden</div>
        <Link href="/" className="text-red-500 hover:underline">← Zurück</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors">
          <span>←</span>
          <span className="text-sm">Startseite</span>
        </Link>
        <span className="font-bold text-white">{vehicle.name}</span>
        {user && <span className="text-zinc-500 text-sm">👤 {user.handle}</span>}
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {result ? (
          <ResultScreen
            result={result}
            vehicleId={vehicle.id}
            handle={user?.handle ?? null}
            onPlayAgain={() => { setResult(null); setGameKey((k) => k + 1); }}
            onHome={() => router.push("/")}
          />
        ) : (
          <GameScreen
            key={gameKey}
            vehicleId={vehicle.id}
            vehicleName={vehicle.name}
            vehicleData={vehicle}
            onFinished={setResult}
          />
        )}
      </main>
    </div>
  );
}
