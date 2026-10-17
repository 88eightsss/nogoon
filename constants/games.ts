// ─── Game Catalogue — single source of truth ─────────────────────────────────
//
// All games organized by category:
//   calm      — breathing, grounding, reflection, low-stimulation
//   puzzle    — logic, visual, spatial reasoning
//   reflex    — reaction time, arcade action
//   skill     — precision, typing, stacking
//   awareness — ad literacy, media critique
//
// arcade.tsx, gate.tsx, and DailyChallengeCard import from here.
// ─────────────────────────────────────────────────────────────────────────────

import { COLORS } from './Colors';

export type GameCategory = 'calm' | 'puzzle' | 'reflex' | 'skill' | 'awareness';

export type GameMeta = {
  id: string;
  name: string;
  description: string; // Shown in arcade card + daily challenge card
  emoji: string;
  color: string;
  tagline: string; // Short accent line shown in arcade card
  howToPlay: string; // Full how-to instructions shown in the info modal
  category: GameCategory;
};

export const ALL_GAMES: readonly GameMeta[] = [

  // ── Calm ────────────────────────────────────────────────────────────────────

  {
    id: 'breathing',
    name: 'Breath Rhythm',
    description: 'Four cycles of box breathing — inhale, hold, exhale, hold.',
    emoji: '🌬️',
    color: '#4d8bff',
    tagline: 'Calms the nervous system',
    howToPlay: 'Follow the animated circle through four rounds of box breathing: inhale for 4 counts, hold for 4, exhale for 4, hold for 4. The game completes automatically after all four rounds.',
    category: 'calm',
  },
  {
    id: 'grounding',
    name: 'Ground Yourself',
    description: '5-4-3-2-1 — anchor to your senses and the present moment.',
    emoji: '🌿',
    color: COLORS.cyan,
    tagline: 'Ground yourself in the moment',
    howToPlay: 'Work through your five senses in order: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. Tap each item as you notice it. A well-known grounding technique for interrupting a craving loop.',
    category: 'calm',
  },

  // ── Puzzle ──────────────────────────────────────────────────────────────────

  {
    id: 'twentyfortyeight',
    name: '2048',
    description: 'Swipe to merge tiles and reach the 2048 tile.',
    emoji: '🔢',
    color: '#b5985a',
    tagline: 'Genuinely hard to put down',
    howToPlay: 'Swipe in any direction to slide all tiles. When two tiles with the same number touch, they merge into one. Keep merging to reach the 2048 tile — or just get as high as you can before the board fills.',
    category: 'puzzle',
  },
  {
    id: 'wordweave',
    name: 'Word Weave',
    description: 'Find 5 hidden words in the letter grid.',
    emoji: '📝',
    color: '#b45309',
    tagline: 'Language flow state',
    howToPlay: 'Five words are hidden in the letter grid. Tap letters in sequence to spell each word — they can connect in any direction (horizontal, vertical, diagonal). Find all five to complete the game.',
    category: 'puzzle',
  },
  {
    id: 'memory',
    name: 'Pattern Memory',
    description: 'Watch the sequence, then tap it back from memory.',
    emoji: '🧩',
    color: COLORS.cyan,
    tagline: 'Trains working memory',
    howToPlay: 'Watch the grid light up in a sequence, then tap the cells back in the same order. Each round adds one more step. One mistake and you start that round over. Complete enough rounds to finish the game.',
    category: 'puzzle',
  },
  {
    id: 'minesweeper',
    name: 'Grid Trap',
    description: 'Navigate a 10×10 grid hiding 12 Goons 👹. Logic, not luck.',
    emoji: '👹',
    color: '#4ade80',
    tagline: 'Dodge the Goons · clear your brain',
    howToPlay: 'Tap a cell to reveal it. Numbers show how many Goons 👹 lurk in the 8 surrounding cells. Long-press to mark a suspected Goon with your brain 🧠. Clear every safe cell without stepping on a Goon to win. First tap is always safe.',
    category: 'puzzle',
  },

  // ── Reflex ──────────────────────────────────────────────────────────────────

  {
    id: 'pixeldodge',
    name: 'Pixel Dodge',
    description: 'Dodge falling blocks. How long can you last?',
    emoji: '👾',
    color: '#22c55e',
    tagline: 'Pure reflex · retro arcade',
    howToPlay: 'Tap the LEFT side of the screen to move your pixel left, RIGHT side to move right. Avoid the blocks raining from above. Survive 30 seconds to win. Miss one and it\'s over — no second chances.',
    category: 'reflex',
  },
  {
    id: 'brickbreak',
    name: 'Brick Break',
    description: 'Slide the paddle to bounce the ball and clear the bricks.',
    emoji: '🧱',
    color: '#f97316',
    tagline: 'Classic arcade · Arkanoid-style',
    howToPlay: 'Slide your finger left and right to move the paddle at the bottom. Bounce the ball to break all the bricks above. Miss the ball three times and it\'s game over. Clear the board to win.',
    category: 'reflex',
  },
  {
    id: 'runner',
    name: 'Goon Run',
    description: 'Endless runner — Rex sprints through an obstacle field that keeps getting faster. Tap to jump.',
    emoji: '🏃',
    color: '#4ade80',
    tagline: 'Endless · speeds up the longer you last',
    howToPlay: 'Tap anywhere to jump. There\'s no finish line — obstacles come in three shapes and the pace keeps ramping up the longer you survive. One hit ends the run, and your score is how long you lasted.',
    category: 'reflex',
  },
  {
    id: 'flappy',
    name: 'Flappy',
    description: 'Tap to fly through gaps. One touch, total focus.',
    emoji: '🐦',
    color: '#facc15',
    tagline: 'One tap · total flow',
    howToPlay: 'Tap anywhere on screen to flap and rise. Let go and you fall. Fly through the gaps between the pipes without hitting them. Each pipe you pass scores a point.',
    category: 'reflex',
  },

  // ── Skill ───────────────────────────────────────────────────────────────────

  {
    id: 'stack',
    name: 'Stack',
    description: 'Drop the sliding block as precisely as you can.',
    emoji: '🏗️',
    color: COLORS.warning,
    tagline: 'How precise can you get?',
    howToPlay: 'A platform slides back and forth at the top of the screen. Tap to drop it onto the stack below. The part that overhangs is cut off — the less overhang, the wider your next platform. Precision keeps the stack going.',
    category: 'skill',
  },
  {
    id: 'typing',
    name: 'Typing Challenge',
    description: 'Type the phrase perfectly before time runs out.',
    emoji: '⌨️',
    color: COLORS.green,
    tagline: 'Speed and accuracy',
    howToPlay: 'Type the displayed phrase exactly as shown before the timer hits zero. One typo resets the current word. Complete the phrase to win — speed and accuracy both matter.',
    category: 'skill',
  },

  // ── Word ──────────────────────────────────────────────────────────────────────

  {
    id: 'goon',
    name: 'Goon',
    description: 'Classic Wordle. A fresh secret word every round — 6 guesses to find it.',
    emoji: '🟩',
    color: '#16a34a',
    tagline: '6 guesses · a new word every round',
    howToPlay: 'Guess the secret 4-letter word in 6 tries. Green = right letter, right spot. Yellow = right letter, wrong spot. Gray = not in the word. Every guess must be a real word.',
    category: 'puzzle',
  },

  // ── Awareness (bottom) ───────────────────────────────────────────────────────

  {
    id: 'oddone',
    name: 'Odd One Out',
    description: 'Spot the manipulative ad. Learn their tricks.',
    emoji: '🕵️',
    color: COLORS.warning,
    tagline: 'Teaches ad literacy',
    howToPlay: 'Each round shows a grid of posts — one is a manipulative ad, the rest are real content. Tap the ad to advance. You\'ll learn to spot dark patterns: fake urgency, engineered FOMO, hidden costs, and misleading claims.',
    category: 'awareness',
  },
] as const;

export type GameId =
  | 'breathing' | 'grounding'
  | 'twentyfortyeight' | 'wordweave' | 'memory' | 'minesweeper' | 'goon'
  | 'pixeldodge' | 'brickbreak' | 'runner' | 'flappy'
  | 'stack' | 'typing'
  | 'oddone';

/** Games available on the gate intercept by default (exclude awareness —
 *  they need context to be meaningful, arcade only — and exclude calm,
 *  which is opt-in; see CALM_GAMES / enabledCalmGateGames below). */
export const GATE_GAMES = ALL_GAMES.filter((g) => g.category !== 'awareness' && g.category !== 'calm');

/** Calm games — breathing, grounding, reflection. Kept out of the gate pool
 *  by default (they're meant for unhurried standalone practice), but a user
 *  can opt individual ones in via toggleCalmGateGame / enabledCalmGateGames. */
export const CALM_GAMES = ALL_GAMES.filter((g) => g.category === 'calm');

/** The short list shown by default. Everything else is still in the app under "More games"
 *  (and every game stays available to the intercept pool); this only trims what you browse. */
export const FEATURED_GAME_IDS: readonly string[] = [
  'breathing', 'grounding',                            // calm: the mission
  'twentyfortyeight', 'memory',                        // puzzle
  'stack',                                             // skill
  'oddone',                                            // awareness: ad literacy
];
export const isFeatured = (id: string) => FEATURED_GAME_IDS.includes(id);

/** Games grouped by category — for arcade.tsx section rendering. */
export function getGamesByCategory(cat: GameCategory): readonly GameMeta[] {
  return ALL_GAMES.filter((g) => g.category === cat);
}

/** Look up any game by ID. */
export function getGameById(id: string): GameMeta | undefined {
  return ALL_GAMES.find((g) => g.id === id);
}

/** Pick a random game ID from the gate pool (puzzle/reflex/skill by default,
 *  plus any calm games the user has explicitly opted in).
 *  Pass `disabledIds` to exclude specific non-calm games. If everything ends
 *  up excluded, falls back to the full default pool so the gate always has
 *  something to show. */
export function pickRandomGame(disabledIds: string[] = [], enabledCalmIds: string[] = []): GameId {
  const base = disabledIds.length > 0
    ? GATE_GAMES.filter((g) => !disabledIds.includes(g.id))
    : GATE_GAMES;
  const optedInCalm = enabledCalmIds.length > 0
    ? CALM_GAMES.filter((g) => enabledCalmIds.includes(g.id))
    : [];
  const pool = [...base, ...optedInCalm];
  const active = pool.length > 0 ? pool : GATE_GAMES;
  return active[Math.floor(Math.random() * active.length)].id as GameId;
}

