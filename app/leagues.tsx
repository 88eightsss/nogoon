// ─── Leagues Screen ───────────────────────────────────────────────────────────
//
// Community leaderboard ranked by lifetime walk-away count.
// Pulls from the Supabase `profiles` table (which already syncs walk_away_count).
// Highlights the current user's row.

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useUserStore } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaderboardEntry {
  id: string;
  name: string;
  walk_away_count: number;
  streak: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `${rank}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeaguesScreen() {
  const { walkAwayCount, name: localName } = useUserStore();
  const { user } = useAuthStore();

  const [rows, setRows]       = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: supaErr } = await supabase
        .from('profiles')
        .select('id, name, walk_away_count, streak')
        .order('walk_away_count', { ascending: false })
        .limit(50);

      if (supaErr) throw supaErr;
      setRows(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  // Find current user's rank (0-indexed in the full list)
  const myRank = user
    ? rows.findIndex((r) => r.id === user.id) + 1  // 1-indexed, 0 if not found
    : 0;

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderRow = ({ item, index }: { item: LeaderboardEntry; index: number }) => {
    const rank  = index + 1;
    const isMe  = user ? item.id === user.id : false;
    const displayName = isMe && localName ? localName : item.name || 'Anonymous';

    return (
      <View
        style={[
          styles.row,
          isMe && styles.myRow,
        ]}
      >
        {/* Rank */}
        <View style={styles.rankCol}>
          {rank <= 3 ? (
            <Text style={styles.rankEmoji}>{rankEmoji(rank)}</Text>
          ) : (
            <Text style={[styles.rankNum, isMe && { color: COLORS.green }]}>{rank}</Text>
          )}
        </View>

        {/* Name */}
        <View style={styles.nameCol}>
          <Text
            style={[styles.name, isMe && { color: COLORS.green, fontFamily: FONTS.bodyBold }]}
            numberOfLines={1}
          >
            {displayName}{isMe ? ' (you)' : ''}
          </Text>
          {item.streak > 0 && (
            <Text style={styles.streakText}>🔥 {item.streak}d streak</Text>
          )}
        </View>

        {/* Walk-away count */}
        <Text style={[styles.count, isMe && { color: COLORS.green }]}>
          {item.walk_away_count}
        </Text>
      </View>
    );
  };

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color={COLORS.textSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Leagues</Text>
          <Text style={styles.headerSub}>ranked by walk-aways</Text>
        </View>
        <Pressable style={styles.backBtn} onPress={load}>
          <Feather name="refresh-cw" size={18} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      {/* My rank banner (shown when user is outside top 10) */}
      {myRank > 10 && user && (
        <View style={styles.myBanner}>
          <Text style={styles.myBannerText}>
            You're ranked <Text style={{ color: COLORS.green, fontFamily: FONTS.bodyBold }}>#{myRank}</Text>
            {' '}with <Text style={{ color: COLORS.green, fontFamily: FONTS.bodyBold }}>{walkAwayCount}</Text> walk-aways
          </Text>
        </View>
      )}

      {/* Column headers */}
      <View style={styles.colHeader}>
        <Text style={[styles.colLabel, { width: 40 }]}>#</Text>
        <Text style={[styles.colLabel, { flex: 1 }]}>Player</Text>
        <Text style={[styles.colLabel, { width: 60, textAlign: 'right' }]}>Walk-Aways</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.green} size="large" />
          <Text style={styles.loadingText}>Loading leaderboard…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="wifi-off" size={32} color={COLORS.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🏆</Text>
          <Text style={styles.emptyTitle}>No players yet</Text>
          <Text style={styles.emptyBody}>Be the first on the board — walk away from a blocked app.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View style={styles.separator} />
          )}
        />
      )}

      {/* Footer note */}
      {!loading && !error && rows.length > 0 && (
        <Text style={styles.footer}>
          Top 50 · lifetime walk-aways · updates on app open
        </Text>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  headerTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },

  // ── My rank banner
  myBanner: {
    backgroundColor: COLORS.green + '18',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.green + '33',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  myBannerText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
  },

  // ── Column header
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  colLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // ── Row
  listContent: {
    paddingVertical: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  myRow: {
    backgroundColor: COLORS.green + '0F',
  },
  rankCol: {
    width: 40,
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 20,
  },
  rankNum: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.textMuted,
    width: 28,
    textAlign: 'center',
  },
  nameCol: {
    flex: 1,
    gap: 2,
    paddingLeft: SPACING.sm,
  },
  name: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  streakText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  count: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.textPrimary,
    width: 60,
    textAlign: 'right',
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.cardBorder,
    marginHorizontal: SPACING.lg,
    opacity: 0.5,
  },

  // ── States
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  loadingText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    marginTop: SPACING.sm,
  },
  errorText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  retryText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    color: COLORS.textPrimary,
  },
  emptyBody: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Footer
  footer: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: SPACING.md,
    opacity: 0.7,
  },
});
