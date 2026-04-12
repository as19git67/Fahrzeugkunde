"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import type { Question } from "@/app/api/questions/route";

interface Box {
  id: number;
  label: string;
  imagePath: string | null;
  hotspotX: number | null;
  hotspotY: number | null;
  hotspotW: number | null;
  hotspotH: number | null;
}

interface Position {
  id: number;
  label: string;
  hotspotX: number | null;
  hotspotY: number | null;
  hotspotW: number | null;
  hotspotH: number | null;
  boxes: Box[];
}

interface Compartment {
  id: number;
  label: string;
  imagePath: string | null;
  hotspotX: number | null;
  hotspotY: number | null;
  hotspotW: number | null;
  hotspotH: number | null;
  positions: Position[];
}

interface VehicleData {
  views: Array<{
    id: number;
    side: string;
    label: string;
    imagePath: string | null;
    compartments: Compartment[];
  }>;
}

interface Props {
  question: Question;
  vehicle: VehicleData;
  onAnswer: (correct: boolean) => void;
  answered: boolean;
}

type NavStep = "view" | "compartment" | "position" | "box";

const SIDE_LABELS: Record<string, string> = {
  left: "Links",
  right: "Rechts",
  back: "Hinten",
  top: "Oben",
  front: "Vorne",
};

export function WhereIsQuestion({ question, vehicle, onAnswer, answered }: Props) {
  const [step, setStep] = useState<NavStep>("view");
  const [selectedView, setSelectedView] = useState<number | null>(null);
  const [selectedComp, setSelectedComp] = useState<number | null>(null);
  const [selectedPos, setSelectedPos] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);

  const target = question.navigationTarget;

  const handleViewClick = (viewId: number) => {
    setSelectedView(viewId);
    setStep("compartment");
  };

  const handleCompClick = (compId: number) => {
    setSelectedComp(compId);
    setStep("position");
  };

  const currentView = vehicle.views.find((v) => v.id === selectedView);
  const currentComp = currentView?.compartments.find((c) => c.id === selectedComp);
  const currentPos = currentComp?.positions.find((p) => p.id === selectedPos);

  const handlePositionClick = (posId: number) => {
    if (answered) return;
    const pos = currentComp?.positions.find((p) => p.id === posId);
    // Wenn Ziel eine Box erwartet und diese Position Boxen hat → nächster Schritt
    if (target?.boxId && pos && pos.boxes.length > 0) {
      setSelectedPos(posId);
      setStep("box");
      return;
    }
    // Wenn Position Boxen hat und der User eine davon wählen könnte → Option anbieten
    if (pos && pos.boxes.length > 0 && !target?.boxId) {
      // Ziel ist die Position direkt (keine Box erwartet) → sofortige Antwort
      const correct = posId === target?.positionId;
      setFeedback(correct ? "correct" : "wrong");
      onAnswer(correct);
      return;
    }
    const correct = posId === target?.positionId && !target?.boxId;
    setFeedback(correct ? "correct" : "wrong");
    onAnswer(correct);
  };

  const handleBoxClick = (boxId: number) => {
    if (answered) return;
    const correct = boxId === target?.boxId;
    setFeedback(correct ? "correct" : "wrong");
    onAnswer(correct);
  };

  if (question.type === "where_is") {
    return <WhereIsChoiceQuestion question={question} onAnswer={onAnswer} answered={answered} />;
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-xl mx-auto">
      <h2 className="text-xl font-bold text-white">
        Wo ist{question.item.article ? ` ${question.item.article}` : ""}{" "}
        <span className="text-red-400">{question.item.name}</span>?
      </h2>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-400 flex-wrap">
        <button
          onClick={() => { setStep("view"); setSelectedView(null); setSelectedComp(null); setSelectedPos(null); }}
          className="hover:text-white transition-colors"
        >
          Fahrzeug
        </button>
        {selectedView && (
          <>
            <span>/</span>
            <button
              onClick={() => { setStep("compartment"); setSelectedComp(null); setSelectedPos(null); }}
              className="hover:text-white transition-colors"
            >
              {SIDE_LABELS[currentView?.side ?? ""] ?? currentView?.label}
            </button>
          </>
        )}
        {selectedComp && (
          <>
            <span>/</span>
            <button
              onClick={() => { setStep("position"); setSelectedPos(null); }}
              className="hover:text-white transition-colors"
            >
              {currentComp?.label}
            </button>
          </>
        )}
        {selectedPos && (
          <>
            <span>/</span>
            <span className="text-white">{currentPos?.label}</span>
          </>
        )}
      </div>

      {/* Schritt 1: Fahrzeugseite wählen */}
      {step === "view" && (
        <div className="grid grid-cols-2 gap-3 w-full">
          {vehicle.views.map((v, i) => (
            <motion.button
              key={v.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleViewClick(v.id)}
              className="relative h-32 rounded-xl overflow-hidden border-2 border-zinc-600 hover:border-red-400 transition-all group"
            >
              {v.imagePath ? (
                <Image src={v.imagePath} alt={v.label} fill className="object-cover group-hover:scale-105 transition-transform" sizes="200px" />
              ) : (
                <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                  <span className="text-4xl">🚒</span>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-1 text-center text-white text-sm font-semibold">
                {v.label}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      {/* Schritt 2: Rolladen/Fach wählen */}
      {step === "compartment" && currentView && (() => {
        const hasHotspots = currentView.compartments.some((c) => c.hotspotX != null);
        return (
        <div className="w-full">
          {currentView.imagePath && hasHotspots ? (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <Image
                src={currentView.imagePath}
                alt={currentView.label}
                fill
                className="object-contain rounded-xl"
                sizes="100vw"
              />
              {currentView.compartments.map((c) =>
                c.hotspotX != null ? (
                  <button
                    key={c.id}
                    onClick={() => handleCompClick(c.id)}
                    className="absolute border-2 border-yellow-400/70 bg-yellow-400/20 hover:bg-yellow-400/40 rounded transition-all"
                    style={{
                      left: `${c.hotspotX}%`,
                      top: `${c.hotspotY}%`,
                      width: `${c.hotspotW}%`,
                      height: `${c.hotspotH}%`,
                    }}
                    title={c.label}
                  >
                    <span className="text-yellow-300 text-xs font-bold">{c.label}</span>
                  </button>
                ) : null
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              {currentView.imagePath && (
                <div className="relative w-full max-w-md" style={{ paddingBottom: "56.25%" }}>
                  <Image
                    src={currentView.imagePath}
                    alt={currentView.label}
                    fill
                    className="object-contain rounded-xl"
                    sizes="100vw"
                  />
                </div>
              )}
              <div className="grid grid-cols-3 gap-3 w-full">
                {currentView.compartments.map((c, i) => (
                  <motion.button
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handleCompClick(c.id)}
                    className="p-4 bg-zinc-800 rounded-xl border-2 border-zinc-600 hover:border-yellow-400 text-white font-bold transition-all"
                  >
                    {c.label}
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Schritt 3: Position wählen */}
      {step === "position" && currentComp && (() => {
        const hasHotspots = currentComp.positions.some((p) => p.hotspotX != null);
        return (
        <div className="w-full">
          {currentComp.imagePath && hasHotspots ? (
            <div className="relative w-full" style={{ paddingBottom: "75%" }}>
              <Image
                src={currentComp.imagePath}
                alt={currentComp.label}
                fill
                className="object-contain rounded-xl"
                sizes="100vw"
              />
              {currentComp.positions.map((p) =>
                p.hotspotX != null ? (
                  <button
                    key={p.id}
                    onClick={() => handlePositionClick(p.id)}
                    disabled={answered}
                    className={`absolute border-2 rounded transition-all ${
                      answered && p.id === target?.positionId && !target?.boxId
                        ? "border-green-400 bg-green-400/40"
                        : "border-blue-400/70 bg-blue-400/20 hover:bg-blue-400/40"
                    }`}
                    style={{
                      left: `${p.hotspotX}%`,
                      top: `${p.hotspotY}%`,
                      width: `${p.hotspotW}%`,
                      height: `${p.hotspotH}%`,
                    }}
                  />
                ) : null
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {currentComp.positions.map((p, i) => {
                const isTarget = p.id === target?.positionId && !target?.boxId;
                let cls = "p-4 rounded-xl border-2 font-semibold text-white transition-all ";
                if (answered) {
                  cls += isTarget ? "bg-green-600 border-green-400" : "bg-zinc-700 border-zinc-600 text-zinc-400";
                } else {
                  cls += "bg-zinc-800 border-zinc-600 hover:border-blue-400";
                }
                return (
                  <motion.button
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => handlePositionClick(p.id)}
                    disabled={answered}
                    className={cls}
                  >
                    {p.label}
                    {p.boxes.length > 0 && (
                      <span className="block text-xs text-zinc-400 font-normal mt-0.5">
                        {p.boxes.length} Kiste{p.boxes.length === 1 ? "" : "n"}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
        );
      })()}

      {/* Schritt 4 (optional): Kiste wählen */}
      {step === "box" && currentPos && (
        <div className="w-full">
          <div className="grid grid-cols-2 gap-3">
            {currentPos.boxes.map((b, i) => {
              const isTarget = b.id === target?.boxId;
              let cls = "p-4 rounded-xl border-2 font-semibold text-white transition-all ";
              if (answered) {
                cls += isTarget ? "bg-green-600 border-green-400" : "bg-zinc-700 border-zinc-600 text-zinc-400";
              } else {
                cls += "bg-zinc-800 border-zinc-600 hover:border-orange-400";
              }
              return (
                <motion.button
                  key={b.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => handleBoxClick(b.id)}
                  disabled={answered}
                  className={cls}
                >
                  📦 {b.label}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {feedback && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-2xl font-black ${feedback === "correct" ? "text-green-400" : "text-red-400"}`}
        >
          {feedback === "correct" ? "✓ Korrekt!" : `✗ Falsch! — ${question.item.locationLabel ?? ""}`}
        </motion.div>
      )}
    </div>
  );
}

// Multiple-Choice Ortsauswahl für "Wo ist das?"
function WhereIsChoiceQuestion({
  question,
  onAnswer,
  answered,
}: {
  question: Question;
  onAnswer: (correct: boolean) => void;
  answered: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleClick = (label: string, correct: boolean) => {
    if (answered || selected) return;
    setSelected(label);
    onAnswer(correct);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      {question.item.imagePath && (
        <div className="relative w-64 h-40 rounded-xl overflow-hidden border-2 border-white/20 bg-zinc-800">
          <Image src={question.item.imagePath} alt={question.item.name} fill className="object-contain p-2" sizes="256px" />
        </div>
      )}

      <h2 className="text-xl font-bold text-white">
        Wo ist{question.item.article ? ` ${question.item.article}` : ""}{" "}
        <span className="text-red-400">{question.item.name}</span>?
      </h2>

      <div className="grid grid-cols-2 gap-3 w-full">
        {question.locationOptions?.map((opt, i) => {
          let cls = "p-4 rounded-xl font-semibold text-sm border-2 transition-all duration-200 text-left ";
          if (answered || selected) {
            if (opt.correct) {
              cls += "bg-green-600 border-green-400 text-white";
            } else if (selected === opt.label) {
              cls += "bg-red-700 border-red-400 text-white";
            } else {
              cls += "bg-zinc-700 border-zinc-600 text-zinc-400";
            }
          } else {
            cls += "bg-zinc-800 border-zinc-600 text-white hover:bg-zinc-700 hover:border-yellow-400 active:scale-95";
          }
          return (
            <motion.button
              key={opt.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cls}
              onClick={() => handleClick(opt.label, opt.correct)}
              disabled={!!(answered || selected)}
            >
              {opt.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
