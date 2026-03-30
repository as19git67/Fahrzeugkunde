"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  delta: number | null;
}

export function ScorePopup({ delta }: Props) {
  return (
    <AnimatePresence>
      {delta !== null && (
        <motion.div
          key={delta + Math.random()}
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -60, scale: 1.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9 }}
          className={`absolute top-0 right-4 text-2xl font-black pointer-events-none z-50 ${
            delta >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {delta >= 0 ? `+${delta}` : delta}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
