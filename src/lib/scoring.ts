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

export const GAME_MODES = ["time_attack", "speed_run"] as const;

/** Time-Attack: Spieldauer in Sekunden. */
export const TIME_ATTACK_DURATION = 60;
/** Speed-Run: Anzahl richtiger Antworten bis zum Ziel. */
export const SPEED_RUN_TARGET = 20;
/** Speed-Run: Zeitstrafe je falscher Antwort (Sekunden). */
export const SPEED_RUN_WRONG_PENALTY_SECONDS = 5;
/**
 * Schneller als das schafft niemand eine Antwort (Feedback-Pause + Klick).
 * Dient der serverseitigen Plausibilitätsprüfung eingereichter Speed-Runs.
 */
export const MIN_SECONDS_PER_ANSWER = 1;

export interface SpeedRunResult {
  wrongAnswers: number;
  penaltySeconds: number;
  /** Gewertete Zeit: Spieldauer plus Strafe. */
  effectiveSeconds: number;
  score: number;
}

/**
 * Speed-Run-Wertung: Es zählt die Zeit bis zur 20. richtigen Antwort; jeder
 * Fehler kostet zusätzlich SPEED_RUN_WRONG_PENALTY_SECONDS. Der Score ist
 * umgekehrt proportional zur gewerteten Zeit, damit die Highscore-Liste
 * (absteigend nach Score) die schnellsten Läufe vorne zeigt.
 */
export function calculateSpeedRunResult({
  durationSeconds,
  correctAnswers,
  totalAnswers,
}: {
  durationSeconds: number;
  correctAnswers: number;
  totalAnswers: number;
}): SpeedRunResult {
  const wrongAnswers = Math.max(0, totalAnswers - correctAnswers);
  const penaltySeconds = wrongAnswers * SPEED_RUN_WRONG_PENALTY_SECONDS;
  const effectiveSeconds = durationSeconds + penaltySeconds;
  return {
    wrongAnswers,
    penaltySeconds,
    effectiveSeconds,
    score: calculateSpeedRunScore(effectiveSeconds, correctAnswers),
  };
}

/**
 * Obergrenze, die eine einzelne richtige Antwort einbringen kann:
 * (Basis + voller Zeitbonus) × höchster Schwierigkeits-Multiplikator plus
 * maximaler Streak-Bonus. Dient der Plausibilitätsprüfung eingereichter
 * Highscores – der Score wird im Client berechnet und ist frei fälschbar.
 */
export const MAX_SCORE_PER_CORRECT_ANSWER =
  Math.round((BASE_CORRECT + MAX_TIME_BONUS) * 2) + Math.floor(BASE_CORRECT * 0.1 * 5);

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
