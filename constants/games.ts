// ─── Game Catalogue — single source of truth ─────────────────────────────────
//
// All 13 games are defined here. arcade.tsx, gate.tsx, and DailyChallengeCard
// import from this file so metadata is never duplicated.
//
// Standard (10): all plans. Pro (3): Pro plan only.
// ─────────────────────────────────────────────────────────────────────────────

import { COLORS } from './Colors';

export type GameTier = 'standard' | 'pro';

export type GameMeta = {
  id: string;
  name: string;
  description: string; // Shown in arcade card + daily challenge card
  emoji: string;
  color: string;
  tier: GameTier;
  tagline: string; // Short accent line shown in arcade card
};

export const ALL_GAMES: readonly GameMeta[] = [
  // ── Standard (10) ──────────────────────────────────────────────────────────
  {
    id: 'breathing',
    name: 'Breath Rhythm',
    description: 'Four cycles of box breathing — inhale, hold, exhale, hold.',
    emoji: '🌬️',
    color: '#4d8bff',
    tier: 'standard',
    tagline: 'Calms the nervous system',
  },
  {
    id: 'grounding',
    name: 'Ground Yourself',
    description: '5-4-3-2-1 — anchor to your senses and the present moment.',
    emoji: '🌿',
    color: COLORS.cyan,
    tier: 'standard',
    tagline: 'Clinically reduces cravings',
  },
  {
    id: 'oddone',
    name: 'Odd One Out',
    description: 'Spot the manipulative ad. Learn their tricks.',
    emoji: '🕵️',
    color: COLORS.warning,
    tier: 'standard',
    tagline: 'Teaches ad literacy',
  },
  {
    id: 'colorsort',
    name: 'Color Sort',
    description: 'Sort the tiles so every row is one solid color.',
    emoji: '🎨',
    color: '#7c3aed',
    tier: 'standard',
    tagline: 'Pure visual flow',
  },
  {
    id: 'ballsort',
    name: 'Ball Sort',
    description: 'Move colored balls until every tube is sorted.',
    emoji: '🧪',
    color: '#0e7490',
    tier: 'standard',
    tagline: 'Satisfying puzzle logic',
  },
  {
    id: 'numberflow',
    name: 'Number Flow',
    description: 'Connect matching numbers and fill every cell.',
    emoji: '🔢',
    color: '#166534',
    tier: 'standard',
    tagline: 'Calm spatial thinking',
  },
  {
    id: 'gemmatch',
    name: 'Gem Match',
    description: 'Swap gems to match 3 or more — no timer, all flow.',
    emoji: '💎',
    color: COLORS.purple,
    tier: 'standard',
    tagline: 'Turn-based, zero pressure',
  },
  {
    id: 'wordweave',
    name: 'Word Weave',
    description: 'Find 5 hidden words in the letter grid.',
    emoji: '📝',
    color: '#b45309',
    tier: 'standard',
    tagline: 'Language flow state',
  },
  {
    id: 'stack',
    name: 'Stack',
    description: 'Drop the sliding block as precisely as you can.',
    emoji: '🏗️',
    color: COLORS.warning,
    tier: 'standard',
    tagline: 'How precise can you get?',
  },
  {
    id: 'memory',
    name: 'Pattern Memory',
    description: 'Watch the sequence, then tap it back from memory.',
    emoji: '🧩',
    color: COLORS.cyan,
    tier: 'standard',
    tagline: 'Trains working memory',
  },
  // ── Pro (3) ────────────────────────────────────────────────────────────────
  {
    id: 'warp',
    name: 'Warp',
    description: 'Drift through the cosmos and collect light fragments.',
    emoji: '✦',
    color: '#7dd3fc',
    tier: 'pro',
    tagline: '✦ Pro exclusive experience',
  },
  {
    id: 'intention',
    name: 'Why Am I Here?',
    description: 'A 60-second check-in with yourself.',
    emoji: '🪞',
    color: COLORS.purple,
    tier: 'pro',
    tagline: '✦ Surfaces the real motivation',
  },
  {
    id: 'typing',
    name: 'Typing Challenge',
    description: 'Type the phrase perfectly before time runs out.',
    emoji: '⌨️',
    color: COLORS.green,
    tier: 'pro',
    tagline: '✦ Pro exclusive',
  },
] as const;

export type GameId =
  | 'breathing' | 'grounding' | 'oddone' | 'colorsort' | 'ballsort'
  | 'numberflow' | 'gemmatch' | 'wordweave' | 'stack' | 'memory'
  | 'warp' | 'intention' | 'typing';

export const STANDARD_GAMES = ALL_GAMES.filter((g) => g.tier === 'standard');
export const PRO_GAMES      = ALL_GAMES.filter((g) => g.tier === 'pro');

/** Look up any game by ID. */
export function getGameById(id: string): GameMeta | undefined {
  return ALL_GAMES.find((g) => g.id === id);
}

/** Pick a random game ID from the appropriate pool. */
export function pickRandomGame(isPro: boolean): GameId {
  const pool = isPro ? ALL_GAMES : STANDARD_GAMES;
  return pool[Math.floor(Math.random() * pool.length)].id as GameId;
}

/**
 * Deterministic daily game: same game for everyone on the same calendar day.
 * Rotates through all standard games in order.
 */
export function getTodaysGame(): GameMeta {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return STANDARD_GAMES[dayOfYear % STANDARD_GAMES.length] as GameMeta;
}
