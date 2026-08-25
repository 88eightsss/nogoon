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
    tagline: 'Clinically reduces cravings',
    howToPlay: 'Work through your five senses in order: name 5 things you can see, 4 you can touch, 3 you can hear, 2 you can smell, 1 you can taste. Tap each item as you notice it. A clinically validated technique for breaking a craving loop.',
    category: 'calm',
  },
  {
    id: 'warp',
    name: 'Warp',
    description: 'Drift through the cosmos and collect light fragments.',
    emoji: '✦',
    color: '#7dd3fc',
    tagline: 'Peaceful · meditative',
    howToPlay: 'Drift through space and tap the glowing light fragments before they fade. They appear at random positions — tap quickly. The game ends when you\'ve collected enough fragments or time runs out. Peaceful and meditative.',
    category: 'calm',
  },
  {
    id: 'intention',
    name: 'Why Am I Here?',
    description: 'A 60-second check-in with yourself.',
    emoji: '🪞',
    color: COLORS.purple,
    tagline: 'Deep reflection',
    howToPlay: 'A series of honest questions about what brought you to this app right now. No wrong answers — just reflection. Takes about 60 seconds. The insight usually makes the urge lose its grip.',
    category: 'calm',
  },

  // ── Puzzle ──────────────────────────────────────────────────────────────────

  {
    id: 'colorsort',
    name: 'Color Sort',
    description: 'Sort the tiles so every row is one solid color.',
    emoji: '🎨',
    color: '#7c3aed',
    tagline: 'Pure visual flow',
    howToPlay: 'Tap a tile to select it, then tap another tile to swap them. The goal: every row must be a single solid color. Solve it in 10 or fewer moves for max points.',
    category: 'puzzle',
  },
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
    description: 'Navigate a 10×10 grid hiding 12 Goons 💩. Logic, not luck.',
    emoji: '💩',
    color: '#4ade80',
    tagline: 'Dodge the Goons · clear your brain',
    howToPlay: 'Tap a cell to reveal it. Numbers show how many Goons 💩 lurk in the 8 surrounding cells. Long-press to mark a suspected Goon with your brain 🧠. Clear every safe cell without stepping on a Goon to win. First tap is always safe.',
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
    id: 'snakegame',
    name: 'Snake',
    description: 'Eat pellets, grow longer, don\'t crash.',
    emoji: '🐍',
    color: '#4ade80',
    tagline: 'Classic · never gets old',
    howToPlay: 'Use the D-pad to steer your snake. Eat the pellets to grow longer and earn points. Don\'t hit the walls or your own tail — either ends the game instantly. Eat 10 pellets to win.',
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
    description: 'The NoGoon pixel mascot runs through an obstacle field. Tap to jump.',
    emoji: '🏃',
    color: '#4ade80',
    tagline: 'Pixel Goon · survive 20s to win',
    howToPlay: 'Tap anywhere to jump. Obstacles come in three shapes and get faster over time. One hit ends the run — no second chances. Survive 20 seconds to win. The NoGoon mascot runs for you.',
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
    description: 'Wordle clone. An opener word is pre-filled — you have 8 guesses to reach GOON.',
    emoji: '🟩',
    color: '#16a34a',
    tagline: '8 guesses · opener pre-filled',
    howToPlay: 'The board starts with a random opener word already played. Use its clues to reach GOON in 7 more guesses. Green = right letter, right spot. Yellow = right letter, wrong spot. Gray = not in the word. All guesses must be valid 4-letter words.',
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
  {
    id: 'spotsponsored',
    name: 'Spot the Sponsored',
    description: 'Scroll through a social feed and flag every hidden ad.',
    emoji: '🚩',
    color: '#f59e0b',
    tagline: 'See what\'s invisible',
    howToPlay: 'A realistic-looking social media feed scrolls by. Five of the posts are hidden ads — some obvious, some sneaky. Tap every post you think is an ad before the 60-second timer runs out. Flag correctly = +20 pts. False positive = −10 pts. After time\'s up, the feed is revealed with each trick explained.',
    category: 'awareness',
  },
] as const;

export type GameId =
  | 'breathing' | 'grounding' | 'warp' | 'intention'
  | 'colorsort' | 'twentyfortyeight' | 'wordweave' | 'memory' | 'minesweeper' | 'goon'
  | 'pixeldodge' | 'snakegame' | 'brickbreak' | 'runner' | 'flappy'
  | 'stack' | 'typing'
  | 'oddone' | 'spotsponsored';

/** Games available on the gate intercept (exclude awareness games — they
 *  need context to be meaningful; show them in arcade only). */
export const GATE_GAMES = ALL_GAMES.filter((g) => g.category !== 'awareness');

/** Games grouped by category — for arcade.tsx section rendering. */
export function getGamesByCategory(cat: GameCategory): readonly GameMeta[] {
  return ALL_GAMES.filter((g) => g.category === cat);
}

/** Look up any game by ID. */
export function getGameById(id: string): GameMeta | undefined {
  return ALL_GAMES.find((g) => g.id === id);
}

/** Pick a random game ID from the gate pool (non-awareness games).
 *  Pass `disabledIds` to exclude specific games. If all are disabled,
 *  falls back to the full pool so the gate always has something to show. */
export function pickRandomGame(disabledIds: string[] = []): GameId {
  const pool = disabledIds.length > 0
    ? GATE_GAMES.filter((g) => !disabledIds.includes(g.id))
    : GATE_GAMES;
  const active = pool.length > 0 ? pool : GATE_GAMES;
  return active[Math.floor(Math.random() * active.length)].id as GameId;
}

/**
 * Deterministic daily game: same game for everyone on the same calendar day.
 * Rotates through all games in order.
 */
export function getTodaysGame(): GameMeta {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return ALL_GAMES[dayOfYear % ALL_GAMES.length] as GameMeta;
}
