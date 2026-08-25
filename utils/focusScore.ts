// ─── Focus Score ─────────────────────────────────────────────────────────────
// A single 0-100 daily score combining three signals:
//
//   Streak bonus      (0–30): min(streak / 30, 1) × 30
//   Walk-away rate    (0–40): todayWalkAways / max(todayOpens, 1), capped at 1, × 40
//   Night compliance  (0–30): penalised 5 pts per late-night open (hour ≥ 22)
//
// Inspired by Opal's Focus Score. Simple enough to explain in a tooltip.

interface FocusScoreInput {
  streak: number;
  walkAwaysToday: number;       // walkAwayActivity[6]
  opensToday: number;           // sum of openCounts for today
  lateNightOpens: number;       // sum of hourlyOpenCounts[22] + [23]
}

export interface FocusScoreBreakdown {
  total: number;          // 0–100
  streakBonus: number;    // 0–30
  walkAwayRate: number;   // 0–40
  nightCompliance: number; // 0–30
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
}

export function computeFocusScore(input: FocusScoreInput): FocusScoreBreakdown {
  const { streak, walkAwaysToday, opensToday, lateNightOpens } = input;

  const streakBonus   = Math.round(Math.min(streak / 30, 1) * 30);
  const rate          = opensToday > 0 ? walkAwaysToday / opensToday : (walkAwaysToday > 0 ? 1 : 0);
  const walkAwayRate  = Math.round(Math.min(rate, 1) * 40);
  const nightPenalty  = Math.min(lateNightOpens * 5, 30);
  const nightCompliance = 30 - nightPenalty;

  const total = Math.min(100, streakBonus + walkAwayRate + nightCompliance);

  const grade: FocusScoreBreakdown['grade'] =
    total >= 90 ? 'S' :
    total >= 75 ? 'A' :
    total >= 55 ? 'B' :
    total >= 35 ? 'C' : 'D';

  return { total, streakBonus, walkAwayRate, nightCompliance, grade };
}

export function gradeColor(grade: FocusScoreBreakdown['grade']): string {
  switch (grade) {
    case 'S': return '#f97316'; // legendary orange
    case 'A': return '#4ade80'; // green
    case 'B': return '#38bdf8'; // cyan
    case 'C': return '#facc15'; // yellow
    case 'D': return '#f87171'; // red
  }
}
