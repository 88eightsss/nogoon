// ─── Impulse Journal Screen ───────────────────────────────────────────────────
//
// A read-only history of all impulse journal entries the user has written.
//
// These entries are created on the game screen — the user writes a short note
// about why they're trying to access a blocked site before the game starts.
// Over time, this builds self-awareness around trigger patterns.
//
// Each entry stores:
//   id        — unique identifier
//   text      — what the user wrote
//   domain    — which site triggered the intercept (e.g. "tiktok.com")
//   timestamp — Unix ms timestamp of when it was created
//
// Route: /journal
// Navigated to from: Profile screen → "Impulse Journal" settings row
// ─────────────────────────────────────────────────────────────────────────────

import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { useUserStore } from '@/stores/useUserStore';

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

  if (delta < 60 * SECOND) {
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

export default function JournalScreen() {
  // Pull all journal entries from the global store
  const { journalEntries } = useUserStore();

  // Show entries newest-first by reversing the array.
  // The store already prepends new entries (index 0 = newest), but .reverse()
  // here makes the intent explicit and safe even if that ever changes.
  const sortedEntries = [...journalEntries].reverse();

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Impulse Journal</Text>
        {/* Spacer keeps title centered */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Privacy note ── */}
        {/* Always shown at the top regardless of whether there are entries */}
        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={14} color={COLORS.textMuted} />
          <Text style={styles.privacyNoteText}>
            These notes are private. Writing down how you feel in the moment
            helps you understand your triggers.
          </Text>
        </View>

        {/* ── Empty state ── */}
        {sortedEntries.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyHeading}>No entries yet</Text>
            <Text style={styles.emptySubtitle}>
              Write a note before your next game session to start building
              your journal.
            </Text>
          </View>
        )}

        {/* ── Entry cards ── */}
        {/* Rendered as a plain map inside ScrollView — simpler than FlatList
            for a screen that never has more than 90 entries (store trims at 90). */}
        {sortedEntries.map((entry) => (
          <View key={entry.id} style={styles.entryCard}>

            {/* Domain chip — shows which site triggered the intercept */}
            <View style={styles.domainChip}>
              <Ionicons name="globe-outline" size={12} color={COLORS.cyan} />
              <Text style={styles.domainText}>{entry.domain}</Text>
            </View>

            {/* The user's journal text */}
            <Text style={styles.entryText}>{entry.text}</Text>

            {/* Relative timestamp — bottom right of the card */}
            <Text style={styles.entryTime}>
              {formatRelativeTime(entry.timestamp)}
            </Text>

          </View>
        ))}

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: COLORS.background },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },

  // ── Header bar ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.background,
  },
  backButton: {
    padding: SPACING.xs,
    marginLeft: -SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  // Matches back button width so title is centered in the row
  headerSpacer: {
    width: 22 + SPACING.xs * 2,
  },

  // ── Privacy note ──
  // Subtle banner at the top — icon + small text, muted colors
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
  },
  privacyNoteText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
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
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: SPACING.xxl,
  },

  // ── Entry cards ──
  // Dark surface card with a subtle border — same pattern used across the app
  entryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },

  // ── Domain chip ──
  // Small pill at the top of each card showing the blocked site's domain
  domainChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.cyanDim,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.cyan + '33',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  domainText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.cyan,
    letterSpacing: 0.3,
  },

  // ── Entry body text ──
  entryText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },

  // ── Relative timestamp ──
  // Sits below the entry text, right-aligned
  entryTime: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: SPACING.xs,
  },
});
