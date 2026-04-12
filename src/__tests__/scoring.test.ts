import { describe, it, expect } from "vitest";
import {
  calculateScore,
  calculateSpeedRunScore,
  calculateTimeAttackScore,
} from "@/lib/scoring";

describe("calculateScore", () => {
  it("returns -50 for wrong answers", () => {
    const result = calculateScore({ correct: false, elapsedMs: 1000 });
    expect(result.total).toBe(-50);
    expect(result.correct).toBe(false);
    expect(result.timeBonus).toBe(0);
  });

  it("returns base 100 + time bonus for fast correct answers", () => {
    const result = calculateScore({ correct: true, elapsedMs: 0 });
    // Base 100 + max time bonus 100 = 200
    expect(result.base).toBe(100);
    expect(result.timeBonus).toBe(100);
    expect(result.total).toBe(200);
    expect(result.correct).toBe(true);
  });

  it("gives no time bonus after 10 seconds", () => {
    const result = calculateScore({ correct: true, elapsedMs: 10000 });
    expect(result.timeBonus).toBe(0);
    expect(result.total).toBe(100);
  });

  it("gives partial time bonus for 5 seconds", () => {
    const result = calculateScore({ correct: true, elapsedMs: 5000 });
    // 100 * (1 - 5/10) = 50
    expect(result.timeBonus).toBe(50);
    expect(result.total).toBe(150);
  });

  it("applies difficulty 2 multiplier (1.5x)", () => {
    const result = calculateScore({
      correct: true,
      elapsedMs: 10000,
      difficulty: 2,
    });
    // (100 + 0) * 1.5 = 150
    expect(result.difficultyMult).toBe(1.5);
    expect(result.total).toBe(150);
  });

  it("applies difficulty 3 multiplier (2x)", () => {
    const result = calculateScore({
      correct: true,
      elapsedMs: 10000,
      difficulty: 3,
    });
    // (100 + 0) * 2 = 200
    expect(result.difficultyMult).toBe(2);
    expect(result.total).toBe(200);
  });

  it("gives no streak bonus for streak < 3", () => {
    const result = calculateScore({
      correct: true,
      elapsedMs: 10000,
      streak: 2,
    });
    expect(result.streakBonus).toBe(0);
    expect(result.total).toBe(100);
  });

  it("gives streak bonus starting at streak 3", () => {
    const result = calculateScore({
      correct: true,
      elapsedMs: 10000,
      streak: 3,
    });
    // streakBonus = floor(100 * 0.1 * min(3-2, 5)) = 10
    expect(result.streakBonus).toBe(10);
    expect(result.total).toBe(110);
  });

  it("caps streak bonus at 5 levels above 2", () => {
    const result = calculateScore({
      correct: true,
      elapsedMs: 10000,
      streak: 20,
    });
    // streakBonus = floor(100 * 0.1 * min(18, 5)) = 50
    expect(result.streakBonus).toBe(50);
    expect(result.total).toBe(150);
  });

  it("combines time bonus, difficulty, and streak", () => {
    const result = calculateScore({
      correct: true,
      elapsedMs: 0,
      difficulty: 3,
      streak: 5,
    });
    // base=100, timeBonus=100, diff=2x, streak=floor(100*0.1*min(3,5))=30
    // total = round((100+100)*2) + 30 = 430
    expect(result.total).toBe(430);
  });

  it("ignores difficulty and streak for wrong answers", () => {
    const result = calculateScore({
      correct: false,
      elapsedMs: 0,
      difficulty: 3,
      streak: 10,
    });
    expect(result.total).toBe(-50);
  });
});

describe("calculateSpeedRunScore", () => {
  it("returns 0 for zero duration", () => {
    expect(calculateSpeedRunScore(0, 10)).toBe(0);
  });

  it("calculates score as 10000 / duration * correct", () => {
    expect(calculateSpeedRunScore(100, 20)).toBe(2000);
  });

  it("gives higher score for faster times", () => {
    const fast = calculateSpeedRunScore(50, 20);
    const slow = calculateSpeedRunScore(200, 20);
    expect(fast).toBeGreaterThan(slow);
  });

  it("rounds the result", () => {
    // 10000 / 3 * 1 = 3333.33... → 3333
    expect(calculateSpeedRunScore(3, 1)).toBe(3333);
  });
});

describe("calculateTimeAttackScore", () => {
  it("returns 0 for empty array", () => {
    expect(calculateTimeAttackScore([])).toBe(0);
  });

  it("sums all scores", () => {
    expect(calculateTimeAttackScore([100, 200, -50, 150])).toBe(400);
  });

  it("handles negative totals", () => {
    expect(calculateTimeAttackScore([-50, -50, -50])).toBe(-150);
  });
});
