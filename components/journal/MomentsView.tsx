// ─── Moments: quick impulse-journal entries (tab inside the Journal space) ───────────────────────────────────────────────────
//
// A running history of impulse journal entries, and — as of this pass — the
// only place that can actually create one. The store action (addJournalEntry)
// and this display screen have existed for a while, but nothing in the app
// ever called addJournalEntry: the old doc comment here said entries were
// "created on the game screen," but no such call site existed anywhere in the
// codebase, so the journal could never have a single entry in it. This adds
// the missing write path directly on this screen (compose anytime, not just
// mid-intercept) plus a small recap header, since a growing personal record
// is the whole point of a journal people come back to.
//
// Each entry stores:
//   id        — unique identifier
//   text      — what the user wrote
//   domain    — which site triggered the intercept ('' for a free entry
//               written from this screen rather than during a block)
//   timestamp — Unix ms timestamp of when it was created
//
// Route: /journal
// Navigated to from: Profile screen → "Impulse Journal" settings row
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { useUserStore } from '@/stores/useUserStore';
import { MOOD_TAGS } from '@/constants/moods';

// ─── Time formatting helper ───────────────────────────────────────────────────
//
// Converts a Unix ms timestamp into a human-readable relative time string.
// Examples: "just now", "5m ago", "3h ago", "Apr 8"
// We keep this simple — no external library needed for these four cases.

function formatRelativeTime(timestamp: number): string {
  const now   = Date.now();
  const delta = now - timestamp; // ms since the entry was written

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;
  const HOUR   = 60 * MINUTE;
  const DAY    = 24 * HOUR;

  if (delta < MINUTE) {
    return 'just now';
  }
  if (delta < 60 * MINUTE) {
    return `${Math.floor(delta / MINUTE)}m ago`;
  }
  if (delta < DAY) {
    return `${Math.floor(delta / HOUR)}h ago`;
  }

  // Older than 24 hours — show a short date like "Apr 8"
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Main component ────────────────────────────────────────────────────────────

export function MomentsView() {
  const { colors, cardStyle } = useTheme();
  const { journalEntries, addJournalEntry } = useUserStore();

  const [composing, setComposing] = useState(false);
  const [draft, setDraft]         = useState('');
  const [draftTag, setDraftTag]   = useState<string | undefined>(undefined);

  // ── Recap ──────────────────────────────────────────────────────────────────
  // Small sense of "this is a record that's growing" — total count plus a
  // rolling 7-day count. Deliberately not a bigger stats block; the Insights
  // screen already owns lifetime numbers, this is just enough to make the
  // list above feel like an accumulating journal rather than a flat log.
  const entriesThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return journalEntries.filter((e) => e.timestamp > weekAgo).length;
  }, [journalEntries]);

  const startComposing = () => {
    setDraft('');
    setDraftTag(undefined);
    setComposing(true);
  };

  const cancelComposing = () => {
    setDraft('');
    setDraftTag(undefined);
    setComposing(false);
  };

  const saveEntry = () => {
    const text = draft.trim();
    if (!text) {
      setComposing(false);
      return;
    }
    // domain '' marks this as written directly here rather than during a
    // blocked-site intercept — the entry card below hides the domain chip
    // when there's no domain to show. The mood tag is optional either way.
    addJournalEntry(text, '', draftTag);
    setDraft('');
    setDraftTag(undefined);
    setComposing(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.safe, { backgroundColor: colors.background }]}>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Recap ── */}
          {journalEntries.length > 0 && (
            <View style={styles.recapRow}>
              <Text style={[styles.recapText, { color: colors.textMuted }]}>
                {journalEntries.length} {journalEntries.length === 1 ? 'entry' : 'entries'}
                {entriesThisWeek > 0 ? ` · ${entriesThisWeek} this week` : ''}
              </Text>
            </View>
          )}

          {/* ── Composer ── */}
          {composing ? (
            <View style={[styles.composerCard, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <TextInput
                style={[styles.composerInput, { color: colors.text }]}
                value={draft}
                onChangeText={setDraft}
                placeholder="What's on your mind?"
                placeholderTextColor={colors.textMuted}
                multiline
                autoFocus
              />

              {/* Optional mood tag — same vocabulary as the post-walk-away
                  reflection pills, tap again to clear. */}
              <View style={styles.moodRow}>
                {MOOD_TAGS.map((m) => {
                  const selected = draftTag === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      style={[
                        styles.moodChip,
                        {
                          borderColor: selected ? colors.accent : colors.cardBorder,
                          backgroundColor: selected ? colors.accentDim : colors.surfaceHigh,
                        },
                      ]}
                      onPress={() => setDraftTag(selected ? undefined : m.id)}
                    >
                      <Text style={styles.moodChipEmoji}>{m.emoji}</Text>
                      <Text style={[styles.moodChipText, { color: selected ? colors.accent : colors.textMuted }]}>
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.composerActions}>
                <Pressable style={styles.composerBtn} onPress={cancelComposing}>
                  <Text style={[styles.composerBtnText, { color: colors.textMuted }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.composerBtn, styles.composerBtnPrimary, { backgroundColor: colors.accentDim }]}
                  onPress={saveEntry}
                >
                  <Text style={[styles.composerBtnText, { color: colors.accent }]}>Save entry</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={[styles.newEntryBtn, { borderColor: colors.cardBorder }]}
              onPress={startComposing}
            >
              <Feather name="edit-3" size={15} color={colors.accent} />
              <Text style={[styles.newEntryText, { color: colors.accent }]}>Add a quick moment</Text>
            </Pressable>
          )}

          {/* ── Privacy note ── */}
          <View style={[styles.privacyNote, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <Feather name="lock" size={14} color={colors.textMuted} />
            <Text style={[styles.privacyNoteText, { color: colors.textMuted }]}>
              These notes are yours — they're never shared with anyone. Writing down how you feel in the moment helps
              you understand your triggers.
            </Text>
          </View>

          {/* ── Empty state ── */}
          {journalEntries.length === 0 && !composing && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>⚡</Text>
              <Text style={[styles.emptyHeading, { color: colors.text }]}>No moments yet</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                Quick notes you jot down in the heat of an urge. For longer, prettier writing, start a page.
              </Text>
            </View>
          )}

          {/* ── Entry cards ── */}
          {/* Rendered as a plain map inside ScrollView — simpler than FlatList
              for a screen that never has more than 90 entries (store trims at 90). */}
          {journalEntries.map((entry) => (
            <View key={entry.id} style={[styles.entryCard, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>

              {/* Domain chip and mood tag — either, both, or neither can be
                  present depending on how/where the entry was written. */}
              {(!!entry.domain || !!entry.tag) && (
                <View style={styles.chipRow}>
                  {!!entry.domain && (
                    <View style={[styles.domainChip, { backgroundColor: colors.accentDim, borderColor: colors.accent + '33' }]}>
                      <Feather name="globe" size={12} color={colors.accent} />
                      <Text style={[styles.domainText, { color: colors.accent }]}>{entry.domain}</Text>
                    </View>
                  )}
                  {!!entry.tag && (() => {
                    const mood = MOOD_TAGS.find((m) => m.id === entry.tag);
                    if (!mood) return null;
                    return (
                      <View style={[styles.domainChip, { backgroundColor: colors.surfaceHigh, borderColor: colors.cardBorder }]}>
                        <Text style={{ fontSize: 12 }}>{mood.emoji}</Text>
                        <Text style={[styles.domainText, { color: colors.textSecondary }]}>{mood.label}</Text>
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* The user's journal text */}
              <Text style={[styles.entryText, { color: colors.text }]}>{entry.text}</Text>

              {/* Relative timestamp — bottom right of the card */}
              <Text style={[styles.entryTime, { color: colors.textMuted }]}>
                {formatRelativeTime(entry.timestamp)}
              </Text>

            </View>
          ))}

          <View style={{ height: SPACING.xxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1 },
  flex:    { flex: 1 },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },

  // ── Header bar ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
    marginLeft: -SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.display,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  // Matches back button width so title is centered in the row
  headerSpacer: {
    width: 22 + SPACING.xs * 2,
  },

  // ── Recap ──
  recapRow: {
    paddingHorizontal: SPACING.xs,
  },
  recapText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 0.2,
  },

  // ── New-entry button (collapsed composer) ──
  newEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  newEntryText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },

  // ── Composer (expanded) ──
  composerCard: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  composerInput: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // ── Mood tag picker (inside composer) ──
  moodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  moodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
  },
  moodChipEmoji: { fontSize: 13 },
  moodChipText: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },

  composerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: SPACING.sm,
  },
  composerBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  composerBtnPrimary: {},
  composerBtnText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
  },

  // ── Privacy note ──
  // Subtle banner — icon + small text, muted colors
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    padding: SPACING.md,
  },
  privacyNoteText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    lineHeight: 19,
  },

  // ── Empty state ──
  // Centered vertically with generous padding; shows when journalEntries is empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.huge,
    gap: SPACING.sm,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  emptyHeading: {
    fontFamily: FONTS.display,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: SPACING.xxl,
  },

  // ── Entry cards ──
  entryCard: {
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },

  // ── Domain / mood chip row ──
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  // Small pill at the top of each card — blocked site domain, mood tag, or both
  domainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  domainText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.3,
  },

  // ── Entry body text ──
  entryText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    lineHeight: 22,
  },

  // ── Relative timestamp ──
  // Sits below the entry text, right-aligned
  entryTime: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
});
