// ─── Mood / urge tags ─────────────────────────────────────────────────────────
//
// The shared vocabulary for "what were you feeling" — used by the post-game
// reflection pills (app/post-game.tsx, which write to urgeJournal) and, as of
// this pass, the optional tag on a journal entry (app/journal.tsx, which
// writes to journalEntries). Previously this list was defined inline inside
// post-game.tsx with no way for anything else to reuse the same tags/emoji —
// pulled out here so a "Bored" tag looks and means the same thing whether it
// was picked right after a walk-away or written later from the Journal tab.

export const MOOD_TAGS = [
  { id: 'Bored',           emoji: '😴', label: 'Bored' },
  { id: 'Stressed',        emoji: '😤', label: 'Stressed' },
  { id: 'Procrastinating', emoji: '⏰', label: 'Avoiding' },
  { id: 'Lonely',          emoji: '🫂', label: 'Lonely' },
  { id: 'Habit',           emoji: '🔁', label: 'Just Habit' },
  { id: 'Anxious',         emoji: '😰', label: 'Anxious' },
] as const;

