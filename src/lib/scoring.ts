export interface ScoreResult {
  base: number;
  timeBonus: number;
  difficultyMult: number;
  streakBonus: number;
  total: number;
  correct: boolean;
}

const BASE_CORRECT = 100;
const BASE_WRONG = -50;
const MAX_TIME_BONUS = 100;
const TIME_WINDOW_SECONDS = 10; // voller Zeitbonus wenn < 10s

export function calculateScore({
  correct,
  elapsedMs,
  difficulty = 1,
  streak = 0,
}: {
  correct: boolean;
  elapsedMs: number;
  difficulty?: number;
  streak?: number;
}): ScoreResult {
  if (!correct) {
    return { base: BASE_WRONG, timeBonus: 0, difficultyMult: 1, streakBonus: 0, total: BASE_WRONG, correct: false };
  }

  const elapsedSec = elapsedMs / 1000;
  const timeBonus = Math.max(
    0,
    Math.round(MAX_TIME_BONUS * Math.max(0, 1 - elapsedSec / TIME_WINDOW_SECONDS))
  );

  const difficultyMult = difficulty === 3 ? 2 : difficulty === 2 ? 1.5 : 1;
  const streakBonus = streak >= 3 ? Math.floor(BASE_CORRECT * 0.1 * Math.min(streak - 2, 5)) : 0;
  const total = Math.round((BASE_CORRECT + timeBonus) * difficultyMult) + streakBonus;

  return { base: BASE_CORRECT, timeBonus, difficultyMult, streakBonus, total, correct: true };
}

// Speed-Run: Punkte = 10000 / Gesamtzeit in Sekunden (höher = schneller)
export function calculateSpeedRunScore(durationSeconds: number, correctAnswers: number): number {
  if (durationSeconds <= 0) return 0;
  return Math.round((10000 / durationSeconds) * correctAnswers);
}

// Time-Attack: Punkte = Summe aller Einzelscores
export function calculateTimeAttackScore(scores: number[]): number {
  return scores.reduce((a, b) => a + b, 0);
}
