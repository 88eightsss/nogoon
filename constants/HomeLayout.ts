// ─── Home Screen Layout System ────────────────────────────────────────────────
//
// Bubble-based customizable home screen.
//
// Each bubble has a widgetId (what it shows) and a size (small | half | full).
// Sizes map to fractional widths in a flex row:
//   small = 1/3,  half = 1/2,  full = 1 (full width)
// The bin-packing row algorithm fills rows greedily and wraps when full.
//
// Templates are starting points users can edit freely.

export type BubbleSize = 'small' | 'half' | 'full';

export type BubbleConfig = {
  id:       string;      // unique instance ID (nanoid-style)
  widgetId: WidgetId;
  size:     BubbleSize;
};

export type HomeLayout = {
  templateId: string;   // last applied template, or 'custom'
  bubbles:    BubbleConfig[];
};

// ─── Widget catalog ───────────────────────────────────────────────────────────

export type WidgetId =
  | 'companion'
  | 'companion-hero'
  | 'counter'
  | 'streak'
  | 'time-saved'
  | 'bill'
  | 'intention'
  | 'breathe'
  | 'games'
  | 'waitingroom'
  | 'bubbles-tool'
  | 'shield'
  | 'spacer';

export type WidgetMeta = {
  id:       WidgetId;
  label:    string;
  desc:     string;
  color:    string;   // accent hex
  defaultSize: BubbleSize;
};

export const WIDGET_CATALOG: WidgetMeta[] = [
  { id: 'companion',       label: 'Companion',      desc: 'Your pet — compact card',             color: '#7c6aed', defaultSize: 'full'  },
  { id: 'companion-hero',  label: 'Companion Hero', desc: 'Your pet — big display with stats',   color: '#7c6aed', defaultSize: 'full'  },
  { id: 'counter',      label: 'Walk-aways',    desc: 'Lifetime count + time reclaimed',   color: '#7c6aed', defaultSize: 'half'  },
  { id: 'streak',       label: 'Consistency',   desc: '30-day score + streak',             color: '#0ea5e9', defaultSize: 'half'  },
  { id: 'time-saved',   label: 'Time saved',    desc: 'Hours of attention reclaimed',      color: '#0277BD', defaultSize: 'half'  },
  { id: 'bill',         label: 'The Bill',      desc: 'What your scroll time costs',       color: '#e0a500', defaultSize: 'half'  },
  { id: 'intention',    label: 'Intention',     desc: "Today's focus intention",           color: '#2E7D32', defaultSize: 'full'  },
  { id: 'breathe',      label: 'Breathe',       desc: 'Box breathing · 2 min',             color: '#4d8bff', defaultSize: 'half'  },
  { id: 'games',        label: 'Games',         desc: 'Redirect the urge',                 color: '#6D28D9', defaultSize: 'half'  },
  { id: 'waitingroom',  label: 'Waiting Room',  desc: 'Sit with the urge',                 color: '#0277BD', defaultSize: 'half'  },
  { id: 'bubbles-tool', label: 'Brain Bubbles', desc: 'Write out the noise',               color: '#0ea5e9', defaultSize: 'half'  },
  { id: 'shield',       label: 'Shield',        desc: 'Blocking status at a glance',       color: '#4caf50', defaultSize: 'full'  },
  { id: 'spacer',       label: 'Spacer',        desc: 'Empty space for organization',      color: '#888888', defaultSize: 'small' },
];

// ─── Helper ───────────────────────────────────────────────────────────────────

let _seq = 0;
export function newBubbleId(): string {
  return `b${Date.now()}${_seq++}`;
}

function b(widgetId: WidgetId, size?: BubbleSize): BubbleConfig {
  const meta = WIDGET_CATALOG.find((w) => w.id === widgetId)!;
  return { id: newBubbleId(), widgetId, size: size ?? meta.defaultSize };
}

// ─── Templates ────────────────────────────────────────────────────────────────

export type Template = {
  id:      string;
  name:    string;
  desc:    string;
  bubbles: BubbleConfig[];
};

export const TEMPLATES: Template[] = [
  {
    id:   'companion',
    name: 'Companion',
    desc: 'Pet card + your two most important stats',
    bubbles: [
      b('companion', 'full'),
      b('counter',   'half'),
      b('streak',    'half'),
      b('intention', 'full'),
    ],
  },
  {
    id:   'hero',
    name: 'Hero',
    desc: 'Big companion front and center with live stats',
    bubbles: [
      b('companion-hero', 'full'),
      b('counter',        'small'),
      b('streak',         'small'),
      b('time-saved',     'small'),
      b('intention',      'full'),
    ],
  },
  {
    id:   'focus',
    name: 'Focus',
    desc: 'Pure numbers — no distractions, just progress',
    bubbles: [
      b('counter',    'half'),
      b('streak',     'half'),
      b('time-saved', 'half'),
      b('bill',       'half'),
      b('intention',  'full'),
    ],
  },
  {
    id:   'compact',
    name: 'Compact',
    desc: 'Three stats in a row, pet on top — efficient',
    bubbles: [
      b('companion',  'full'),
      b('counter',    'small'),
      b('streak',     'small'),
      b('time-saved', 'small'),
      b('intention',  'full'),
    ],
  },
  {
    id:   'calm',
    name: 'Calm',
    desc: 'Recovery tools + pet — for the hard days',
    bubbles: [
      b('companion',   'full'),
      b('breathe',     'half'),
      b('waitingroom', 'half'),
      b('intention',   'full'),
    ],
  },
  {
    id:   'minimal',
    name: 'Minimal',
    desc: 'Just the essentials — nothing more',
    bubbles: [
      b('companion', 'full'),
      b('counter',   'full'),
    ],
  },
  {
    id:   'full-house',
    name: 'Full House',
    desc: 'Everything unlocked — a starting point to customize',
    bubbles: [
      b('companion',   'full'),
      b('counter',     'half'),
      b('streak',      'half'),
      b('time-saved',  'half'),
      b('bill',        'half'),
      b('breathe',     'half'),
      b('waitingroom', 'half'),
      b('intention',   'full'),
    ],
  },
];

export const DEFAULT_LAYOUT: HomeLayout = {
  templateId: 'hero',
  bubbles: TEMPLATES.find((t) => t.id === 'hero')!.bubbles.map((b) => ({ ...b, id: newBubbleId() })),
};
