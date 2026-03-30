"use client";

import { motion, AnimatePresence } from "framer-motion";

export function StreakBadge({ streak }: { streak: number }) {
  if (streak < 3) return null;
  return (
    <AnimatePresence>
      <motion.div
        key={streak}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-1 bg-orange-500 text-white px-2 py-1 rounded-full text-sm font-bold"
      >
        🔥 {streak}er Serie
      </motion.div>
    </AnimatePresence>
  );
}
