// ─── How the mascot feels ─────────────────────────────────────────────────────
//
// The companion's mood comes from things that are really true about the user's day, not a
// hunger bar: the clock, whether protection is on, whether they walked away today, and how
// long it has been. It never scolds. A lonely or worried mascot asks for company, and a
// pet or a walk-away cheers it up. Pure functions, so they are easy to test.

export type Mood = 'sleepy' | 'worried' | 'proud' | 'lonely' | 'happy' | 'calm';
export type SpotKey = 'door' | 'window' | 'board' | 'bed' | 'dresser';

export const MOOD_LABEL: Record<Mood, string> = {
  sleepy: 'sleepy', worried: 'worried', proud: 'proud', lonely: 'lonely', happy: 'happy', calm: 'calm',
};

export type MoodInput = {
  hour: number;                    // 0-23
  walkAwaysToday: number;
  daysSinceWalkAway: number | null; // null = never (a brand-new user is not "lonely")
  protectionOff: boolean;          // blocking is off or has nothing to block
  pets: number;                    // pets this visit; a few pets lift a low mood
};

export const isNight = (hour: number) => hour >= 20 || hour < 6;

export function moodOf(i: MoodInput): Mood {
  if (isNight(i.hour)) return 'sleepy';
  if (i.protectionOff) return 'worried';
  if (i.walkAwaysToday >= 1) return 'proud';
  const away = i.daysSinceWalkAway;
  if (away !== null && away >= 3 && i.pets < 2) return 'lonely';
  if (i.pets >= 2 || (away !== null && away <= 1)) return 'happy';
  return 'calm';
}

/** Whole days since the most recent day with a walk-away in a { 'YYYY-MM-DD': count } map. */
export function daysSinceWalkAway(map: Record<string, number>, todayKey: string): number | null {
  let last: string | null = null;
  for (const [k, v] of Object.entries(map)) if (v > 0 && (last === null || k > last)) last = k;
  if (!last) return null;
  const a = Date.parse(`${last}T12:00:00Z`), b = Date.parse(`${todayKey}T12:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

// Where the mascot likes to be for each mood (spot keys are room objects; 'rug' is home).
export type StandKey = SpotKey | 'rug';
export const MOOD_HOME: Record<Mood, StandKey> = {
  sleepy: 'bed', worried: 'door', proud: 'rug', lonely: 'window', happy: 'rug', calm: 'rug',
};
/** Places it wanders between while idle. */
export const MOOD_WANDER: Record<Mood, StandKey[]> = {
  sleepy: ['bed'],
  worried: ['door', 'rug', 'door'],
  proud: ['rug', 'board', 'rug', 'dresser'],
  lonely: ['window', 'window', 'rug'],
  happy: ['rug', 'window', 'dresser', 'board', 'rug'],
  calm: ['rug', 'window', 'rug', 'dresser'],
};

const OBJECT_LINE: Record<Mood, Record<SpotKey, string>> = {
  sleepy: {
    door: 'The door is locked for the night. Hold to check.',
    window: 'Stars are out. Hold to open the window.',
    board: 'Yawn. The board will keep till morning.',
    bed: 'Mmm. Hold to open the bed and wind down.',
    dresser: 'My things are all put away. Hold to peek.',
  },
  worried: {
    door: 'This is the one I am worried about. Hold to fix it.',
    window: 'I would feel better once the door is sorted.',
    board: 'Later. Door first?',
    bed: 'Hard to rest with the door like that.',
    dresser: 'Hold to open settings, if that helps.',
  },
  proud: {
    door: 'Nothing got past us today. Hold to check.',
    window: 'Good news is waiting. Hold to read it.',
    board: 'The board is yours. Hold to see it.',
    bed: 'We earned a rest. Hold to unwind.',
    dresser: 'Look at everything we have kept. Hold to see.',
  },
  lonely: {
    door: 'It has been quiet. Walk away with me?',
    window: 'I was watching for you. Hold to open the window.',
    board: 'Come see what is out there. Hold to open.',
    bed: 'Want to unwind together? Hold to open.',
    dresser: 'Hold to see how far we have come.',
  },
  happy: {
    door: 'All locked in. Hold to look.',
    window: 'Something good today? Hold to open.',
    board: 'Ooh, the board. Hold to open it.',
    bed: 'Cosy. Hold to unwind.',
    dresser: 'My favourite drawer. Hold to open.',
  },
  calm: {
    door: 'Hold to open your blocking.',
    window: 'Hold to open today\'s briefing.',
    board: 'Hold to open the board.',
    bed: 'Hold to open Unwind.',
    dresser: 'Hold to open Me.',
  },
};

const PET_LINES: Record<Mood, string[]> = {
  sleepy: ['Five more minutes...', 'Zzz. Mm?', 'I am awake. A little.'],
  worried: ['Thank you. I still need that door.', 'That helps a bit.', 'Okay. Okay. Deep breath.'],
  proud: ['We did it!', 'That is the good stuff.', 'I could do this all day.'],
  lonely: ['You came back.', 'I missed you.', 'Stay a minute?'],
  happy: ['Hee. Again.', 'Right there.', 'You are good at this.'],
  calm: ['Mm. Nice.', 'Thanks for stopping by.', 'I like it here.'],
};

export const objectLine = (mood: Mood, spot: SpotKey) => OBJECT_LINE[mood][spot];
export const petLine = (mood: Mood, n: number) => PET_LINES[mood][n % PET_LINES[mood].length];

/** One line for the gate, so the companion there matches how it feels on Today. */
export function gateLine(mood: Mood, name: string): string {
  switch (mood) {
    case 'sleepy':  return `${name} is sleepy. This can wait until morning.`;
    case 'lonely':  return `${name} missed you. Walk away with me?`;
    case 'proud':   return `${name} is proud of you today. Keep it going.`;
    case 'happy':   return `${name} is doing great. Put the phone down for a bit.`;
    case 'worried': return `${name} is a little worried. Take a breath first.`;
    default:        return `${name} is here. Put the phone down for a bit.`;
  }
}
