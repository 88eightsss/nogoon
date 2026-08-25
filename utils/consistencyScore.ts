// ─── 30-Day Consistency Score ─────────────────────────────────────────────────
//
// Unlike a streak (which resets catastrophically on one missed day), the
// consistency score is a rolling 30-day percentage: days you walked away
// at least once / days the gate fired at all. A bad day doesn't erase progress.
//
// Score: 0–100%
// Grade: S (≥90%), A (≥75%), B (≥55%), C (≥35%), D (<35%)

export interface ConsistencyResult {
  score: number;       // 0–100
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  daysActive: number;  // days with ≥1 gate fire in last 30
  daysWon: number;     // days with ≥1 walk-away in last 30
}

export function computeConsistencyScore(
  dailyGateFires: Record<string, number>,
  dailyWalkAways: Record<string, number>,
): ConsistencyResult {
  const today = new Date();
  let daysActive = 0;
  let daysWon = 0;

  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if ((dailyGateFires[key] ?? 0) > 0) {
      daysActive++;
      if ((dailyWalkAways[key] ?? 0) > 0) {
        daysWon++;
      }
    }
  }

  const score = daysActive === 0 ? 0 : Math.round((daysWon / daysActive) * 100);

  let grade: ConsistencyResult['grade'];
  if (score >= 90) grade = 'S';
  else if (score >= 75) grade = 'A';
  else if (score >= 55) grade = 'B';
  else if (score >= 35) grade = 'C';
  else grade = 'D';

  return { score, grade, daysActive, daysWon };
}
