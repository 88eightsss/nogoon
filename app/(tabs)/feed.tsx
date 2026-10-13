// ─── Feed — one good thing a day ──────────────────────────────────────────────
//
// A calm destination tab (new layout only). Pulls one positive headline from the
// existing `positive-news` edge function and caches it per day so we make at most
// one request a day (the function is not cached server-side yet). Journal and
// Brain Bubbles live here too.

import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/hooks/useTheme';
import { getLocalDateKey } from '@/utils/date';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

type NewsItem = { headline: string; summary: string; source: string };

export default function FeedScreen() {
  const { colors, cardStyle } = useTheme();
  const [item, setItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    const key = `nogoon_feed_${getLocalDateKey()}`;
    try {
      const cached = await AsyncStorage.getItem(key);
      if (cached) { setItem(JSON.parse(cached) as NewsItem); return; }
      const { data, error } = await supabase.functions.invoke('positive-news');
      if (error || !data?.headline) { setFailed(true); return; }
      setItem(data as NewsItem);
      AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => {});
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>One good thing today</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>A new one arrives each day. That's all. Nothing to scroll.</Text>

      <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        {loading && <ActivityIndicator color={colors.accent} />}
        {!loading && item && (
          <>
            <Text style={[styles.headline, { color: colors.text }]}>{item.headline}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{item.summary}</Text>
            {item.source ? <Text style={[styles.source, { color: colors.textMuted }]}>{item.source}</Text> : null}
          </>
        )}
        {!loading && failed && (
          <>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              Couldn't fetch today's good news. Good things are still happening out there, and you're protecting your time.
            </Text>
            <Pressable onPress={load} style={[styles.btn, { borderColor: colors.border }]}>
              <Text style={[styles.btnText, { color: colors.text }]}>Try again</Text>
            </Pressable>
          </>
        )}
      </View>

      <Text style={[styles.section, { color: colors.textMuted }]}>Write it out</Text>
      {[
        { icon: 'book-open' as const, label: 'Journal', body: 'Log an urge or a win.', go: () => router.push('/journal' as any) },
        { icon: 'edit-3' as const,    label: 'Brain Bubbles', body: 'Dump the noise onto a canvas.', go: () => router.push('/bubbles' as any) },
        { icon: 'bar-chart-2' as const, label: 'Insights', body: 'Your patterns, kindly told.', go: () => router.push('/insights' as any) },
      ].map((r) => (
        <Pressable
          key={r.label}
          onPress={r.go}
          style={[styles.row, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
        >
          <Feather name={r.icon} size={20} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>{r.label}</Text>
            <Text style={[styles.rowBody, { color: colors.textSecondary }]}>{r.body}</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.textMuted} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content:  { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  title:    { fontFamily: FONTS.display, fontSize: 26 },
  sub:      { fontFamily: FONTS.body, fontSize: 13 },
  card:     { padding: SPACING.lg, gap: SPACING.sm, minHeight: 120, justifyContent: 'center' },
  headline: { fontFamily: FONTS.bodyBold, fontSize: 19, lineHeight: 26 },
  body:     { fontFamily: FONTS.body, fontSize: 14.5, lineHeight: 21 },
  source:   { fontFamily: FONTS.body, fontSize: 12 },
  btn:      { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 16 },
  btnText:  { fontFamily: FONTS.bodyBold, fontSize: 13 },
  section:  { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: SPACING.sm },
  row:      { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  rowTitle: { fontFamily: FONTS.bodyBold, fontSize: 15 },
  rowBody:  { fontFamily: FONTS.body, fontSize: 12.5 },
});
