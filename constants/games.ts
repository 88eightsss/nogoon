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
  howToPlay: string; // Full how-to instructions shown in the info modal
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
    howToPlay: 'Follow the animated circle through four rounds of box breathing: inhale for 4 counts, hold for 4, exhale for 4, hold for 4. The game completes automatically after all four rounds.',
  },
  {
    id: 'grounding',
    name: 'Ground Yourself',
    description: '5-4-3-2-1 — anchor to your senses and the present moment.',
    emoji: '🌿',
    color: COLORS.cyan,
    tier: 'standard',
    tagline: 'Clinically reduces cravings',
    howToPlay: 'Work through your five senses in order: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. Tap each item as you notice it. A clinically validated technique for breaking a craving loop.',
  },
  {
    id: 'oddone',
    name: 'Odd One Out',
    description: 'Spot the manipulative ad. Learn their tricks.',
    emoji: '🕵️',
    color: COLORS.warning,
    tier: 'standard',
    tagline: 'Teaches ad literacy',
    howToPlay: 'Each round shows a grid of posts — one is a manipulative ad, the rest are real content. Tap the ad to advance. You\'ll learn to spot dark patterns: fake urgency, engineered FOMO, hidden costs, and misleading claims.',
  },
  {
    id: 'colorsort',
    name: 'Color Sort',
    description: 'Sort the tiles so every row is one solid color.',
    emoji: '🎨',
    color: '#7c3aed',
    tier: 'standard',
    tagline: 'Pure visual flow',
    howToPlay: 'Tap a tile to select it, then tap another tile to swap them. The goal: every row must be a single solid color. Solve it in 10 or fewer moves for max points.',
  },
  {
    id: 'ballsort',
    name: 'Ball Sort',
    description: 'Move colored balls until every tube is sorted.',
    emoji: '🧪',
    color: '#0e7490',
    tier: 'standard',
    tagline: 'Satisfying puzzle logic',
    howToPlay: 'Tap a tube to lift its top ball, then tap another tube to drop it there. Sort all balls so each tube contains only one color. You can only place a ball on a ball of the same color, or into an empty tube.',
  },
  {
    id: 'twentyfortyeight',
    name: '2048',
    description: 'Swipe to merge tiles and reach the 2048 tile.',
    emoji: '🔢',
    color: '#5b52f0',
    tier: 'standard',
    tagline: 'Genuinely hard to put down',
    howToPlay: 'Swipe in any direction to slide all tiles. When two tiles with the same number touch, they merge into one. Keep merging to reach the 2048 tile — or just get as high as you can before the board fills.',
  },
  {
    id: 'gemmatch',
    name: 'Gem Match',
    description: 'Swap gems to match 3 or more — no timer, all flow.',
    emoji: '💎',
    color: COLORS.purple,
    tier: 'standard',
    tagline: 'Turn-based, zero pressure',
    howToPlay: 'Tap a gem to select it, then tap an adjacent gem to swap them. Match 3 or more gems in a row or column to clear them and earn points. Matches can be horizontal, vertical, or diagonal. No timer — take your time.',
  },
  {
    id: 'wordweave',
    name: 'Word Weave',
    description: 'Find 5 hidden words in the letter grid.',
    emoji: '📝',
    color: '#b45309',
    tier: 'standard',
    tagline: 'Language flow state',
    howToPlay: 'Five words are hidden in the letter grid. Tap letters in sequence to spell each word — they can connect in any direction (horizontal, vertical, diagonal). Find all five to complete the game.',
  },
  {
    id: 'stack',
    name: 'Stack',
    description: 'Drop the sliding block as precisely as you can.',
    emoji: '🏗️',
    color: COLORS.warning,
    tier: 'standard',
    tagline: 'How precise can you get?',
    howToPlay: 'A platform slides back and forth at the top of the screen. Tap to drop it onto the stack below. The part that overhangs is cut off — the less overhang, the wider your next platform. Precision keeps the stack going.',
  },
  {
    id: 'memory',
    name: 'Pattern Memory',
    description: 'Watch the sequence, then tap it back from memory.',
    emoji: '🧩',
    color: COLORS.cyan,
    tier: 'standard',
    tagline: 'Trains working memory',
    howToPlay: 'Watch the grid light up in a sequence, then tap the cells back in the same order. Each round adds one more step. One mistake and you start that round over. Complete enough rounds to finish the game.',
  },
  // ── Pro (3) ──────────────────────────────────────────────────────────────────────────
  {
    id: 'warp',
    name: 'Warp',
    description: 'Drift through the cosmos and collect light fragments.',
    emoji: '✦',
    color: '#7dd3fc',
    tier: 'pro',
    tagline: '✦ Pro exclusive experience',
    howToPlay: 'Drift through space and tap the glowing light fragments before they fade. They appear at random positions — tap quickly. The game ends when you\'ve collected enough fragments or time runs out. Peaceful and meditative.',
  },
  {
    id: 'intention',
    name: 'Why Am I Here?',
    description: 'A 60-second check-in with yourself.',
    emoji: '🪞',
    color: COLORS.purple,
    tier: 'pro',
    tagline: '✦ Surfaces the real motivation',
    howToPlay: 'A series of honest questions about what brought you to this app right now. No wrong answers — just reflection. Takes about 60 seconds. The insight usually makes the urge lose its grip.',
  },
  {
    id: 'typing',
    name: 'Typing Challenge',
    description: 'Type the phrase perfectly before time runs out.',
    emoji: '⌨️',
    color: COLORS.green,
    tier: 'pro',
    tagline: '✦ Pro exclusive',
    howToPlay: 'Type the displayed phrase exactly as shown before the timer hits zero. One typo resets the current word. Complete the phrase to win — speed and accuracy both matter.',
  },
] as const;

export type GameId =
  | 'breathing' | 'grounding' | 'oddone' | 'colorsort' | 'ballsort'
  | 'twentyfortyeight' | 'gemmatch' | 'wordweave' | 'stack' | 'memory'
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
