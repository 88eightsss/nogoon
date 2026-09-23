// ─── PositiveNewsCard ─────────────────────────────────────────────────────── //
//
// Shown as a reward after a successful walk-away.
// Calls the 'positive-news' Supabase edge function which fetches real
// headlines via NewsAPI and rewrites the most uplifting one using Claude.

import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

type NewsItem = {
  headline: string;
  summary: string;
  source: string;
};

type Props = {
  onDone: () => void;
};

export function PositiveNewsCard({ onDone }: Props) {
  const [news, setNews]       = useState<NewsItem | null>(null);
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.functions
      .invoke('positive-news')
      .then(({ data, error: err }) => {
        if (err || !data?.headline) setError(true);
        else setNews(data as NewsItem);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.container}>
      {/* Label */}
      <Text style={styles.label}>WHILE YOU WERE AWAY</Text>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={COLORS.green} size="small" />
          <Text style={styles.loadingText}>Finding something good in the world...</Text>
        </View>
      )}

      {/* Error fallback */}
      {!loading && error && (
        <View style={styles.card}>
          <Text style={styles.cardSummary}>
            Good things are happening out there. You just chose one of them — protecting your time.
          </Text>
        </View>
      )}

      {/* News card */}
      {!loading && news && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="sun" size={18} color={COLORS.warning} />
            <Text style={styles.cardHeadline}>{news.headline}</Text>
          </View>
          <Text style={styles.cardSummary}>{news.summary}</Text>
          {news.source ? (
            <Text style={styles.cardSource}>— {news.source}</Text>
          ) : null}
        </View>
      )}

      {/* Dismiss */}
      <Pressable style={styles.doneButton} onPress={onDone}>
        <Text style={styles.doneText}>Back to life →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.xl,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  loadingBox: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
  },
  card: {
    backgroundColor: COLORS.surfaceHigh,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.warning + '33',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.warning,
    padding: SPACING.xl,
    gap: SPACING.sm,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  cardHeadline: {
    flex: 1,
    fontFamily: FONTS.display,
    fontSize: 20,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  cardSummary: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 23,
  },
  cardSource: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  doneButton: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  doneText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
});
