"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { Question } from "@/app/api/questions/route";

interface Props {
  question: Question;
  onAnswer: (correct: boolean) => void;
  answered: boolean;
  wasCorrect: boolean | null;
}

export function WhatIsQuestion({ question, onAnswer, answered, wasCorrect }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Was ist das?</h2>

      {question.item.imagePath && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative w-72 h-48 rounded-xl overflow-hidden border-2 border-white/20 bg-zinc-800"
        >
          <Image
            src={question.item.imagePath}
            alt="Gerät"
            fill
            className="object-contain p-2"
            sizes="288px"
          />
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-3 w-full">
        {question.options?.map((opt, i) => {
          const isCorrect = opt.id === question.item.id;
          let btnClass =
            "p-3 rounded-xl font-semibold text-sm border-2 transition-all duration-200 text-left ";

          if (answered) {
            if (isCorrect) {
              btnClass += "bg-green-600 border-green-400 text-white";
            } else {
              btnClass += "bg-zinc-700 border-zinc-600 text-zinc-400";
            }
          } else {
            btnClass +=
              "bg-zinc-800 border-zinc-600 text-white hover:bg-zinc-700 hover:border-red-400 active:scale-95";
          }

          return (
            <motion.button
              key={opt.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={btnClass}
              onClick={() => !answered && onAnswer(isCorrect)}
              disabled={answered}
            >
              <span className="text-zinc-400 mr-2">
                {String.fromCharCode(65 + i)})
              </span>
              {opt.article ? <span className="text-zinc-400 mr-1">{opt.article}</span> : null}
              {opt.name}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
