// ─── Journal look & feel: paper, ink, stickers, templates ─────────────────────
// Everything a journal page can be dressed with. Add to these lists to add options.

import type { CharacterId } from '@/stores/usePetStore';

export type PaperId = 'cream' | 'blush' | 'peach' | 'butter' | 'mint' | 'sky' | 'lavender' | 'night';
export const PAPERS: { id: PaperId; label: string; color: string; ink: string }[] = [
  { id: 'cream',    label: 'Cream',    color: '#FFF6E5', ink: '#2B2A33' },
  { id: 'blush',    label: 'Blush',    color: '#FFE0EA', ink: '#3A2030' },
  { id: 'peach',    label: 'Peach',    color: '#FFE4D0', ink: '#3A2A20' },
  { id: 'butter',   label: 'Butter',   color: '#FFF2B0', ink: '#33300F' },
  { id: 'mint',     label: 'Mint',     color: '#D8F5E4', ink: '#12302A' },
  { id: 'sky',      label: 'Sky',      color: '#D6EAFF', ink: '#14263F' },
  { id: 'lavender', label: 'Lavender', color: '#E8DEFF', ink: '#2A2145' },
  { id: 'night',    label: 'Night',    color: '#1E2142', ink: '#F4F1FF' },
];

export type PatternId = 'plain' | 'lined' | 'dots' | 'grid';
export const PATTERNS: { id: PatternId; label: string }[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'lined', label: 'Lined' },
  { id: 'dots',  label: 'Dots' },
  { id: 'grid',  label: 'Grid' },
];

export type FrameId = 'none' | 'tape' | 'dashed' | 'double';
export const FRAMES: { id: FrameId; label: string }[] = [
  { id: 'none',   label: 'None' },
  { id: 'tape',   label: 'Washi tape' },
  { id: 'dashed', label: 'Stitched' },
  { id: 'double', label: 'Double line' },
];

export type FontId = 'soft' | 'bold' | 'type';
export const FONT_CHOICES: { id: FontId; label: string }[] = [
  { id: 'soft', label: 'Soft' },
  { id: 'bold', label: 'Bold' },
  { id: 'type', label: 'Typewriter' },
];

/** Text sizes: index 0 small, 1 medium, 2 large, 3 extra large. */
export const TEXT_SIZES = [15, 18, 22, 27] as const;

export const INKS = ['#2B2A33', '#E5484D', '#F76B15', '#E5A000', '#30A46C', '#0091FF', '#8E4EC6', '#E93D82', '#FFFFFF'];
export const PEN_WIDTHS = [4, 9, 18] as const;   // in the 1000-unit page space

export type StickerGroup = { id: string; label: string; items: string[] };
export const STICKER_GROUPS: StickerGroup[] = [
  { id: 'feel',   label: 'Feelings', items: ['😊', '🥹', '😌', '😤', '😴', '🤗', '🥳', '😭', '🫶', '💪', '🧠', '🌈'] },
  { id: 'nature', label: 'Nature',   items: ['🌸', '🌻', '🌿', '🍀', '🌊', '☀️', '🌙', '⭐', '🔥', '🦋', '🐢', '🌴'] },
  { id: 'treat',  label: 'Treats',   items: ['🍉', '🍓', '🥭', '🍵', '🍪', '🥑', '🧋', '🍜', '🍙', '🍍', '☕', '🍰'] },
  { id: 'do',     label: 'Doing',    items: ['📚', '✏️', '🎧', '🏃', '🧘', '📞', '🎨', '🎸', '🚶', '🧹', '🌅', '🏄'] },
  { id: 'marks',  label: 'Marks',    items: ['❤️', '✨', '✅', '📌', '💡', '🎯', '🏆', '🔑', '💬', '➡️', '❗', '🎀'] },
];

/** Sticker ids: `e:<emoji>` for an emoji, `m:<characterId>` for a companion sprite. */
export const MASCOT_STICKERS: CharacterId[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export type PageTemplate = {
  id: string;
  label: string;
  blurb: string;
  paper: PaperId;
  pattern: PatternId;
  body: string;
  stickers: string[];     // starter stickers (placed along the top)
  prompt?: boolean;       // marks "prompt-style" pages
};

export const TEMPLATES: PageTemplate[] = [
  { id: 'blank',   label: 'Blank page',   blurb: 'Start from nothing.',                  paper: 'cream',    pattern: 'plain', body: '', stickers: [] },
  { id: 'dump',    label: 'Brain dump',   blurb: 'Get the noise out of your head.',      paper: 'sky',      pattern: 'lined', body: 'Everything in my head right now:\n\n', stickers: ['🧠'] },
  { id: 'thanks',  label: 'Three good things', blurb: 'What went right today.',          paper: 'butter',   pattern: 'dots',  body: 'Three things I am glad of today:\n1. \n2. \n3. ', stickers: ['🌻', '✨'] },
  { id: 'urge',    label: 'Urge log',     blurb: 'Catch the craving and look at it.',    paper: 'lavender', pattern: 'lined', body: 'What pulled me in?\n\nWhat was I feeling just before?\n\nWhat will I do instead?\n', stickers: ['🌊'] },
  { id: 'proud',   label: 'Proud of',     blurb: 'Small wins count.',                    paper: 'blush',    pattern: 'plain', body: 'Something I am proud of this week:\n\n', stickers: ['🏆', '💪'] },
  { id: 'future',  label: 'Letter to future me', blurb: 'Say what you want to remember.', paper: 'mint',     pattern: 'lined', body: 'Dear future me,\n\n', stickers: ['💬'] },
  { id: 'plan',    label: "Tomorrow's plan", blurb: 'Three things, that is all.',        paper: 'peach',    pattern: 'grid',  body: "Tomorrow I will:\n1. \n2. \n3. \n\nI'll know I did well if:\n", stickers: ['🎯'] },
];

export const PROMPTS = [
  'What did I reach for my phone to avoid today?',
  'Describe a moment today when I felt completely present.',
  'Who would I love to hear from, and what would I say to them?',
  'What is one thing I can do with my hands instead of scrolling?',
  'What did I want to feel when I opened that app?',
  'Where in my body do I feel this urge right now?',
  'What would a good Saturday look like if nothing was on my phone?',
  'List five small things that made me smile this week.',
  'What am I looking forward to?',
  'What is something I can forgive myself for today?',
];
