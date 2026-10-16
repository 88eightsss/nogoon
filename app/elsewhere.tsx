// ─── Beyond the screen ────────────────────────────────────────────────────────
//
// Calmer places to be social online, and ways to find people and things to do in
// person. Everything is a link the user taps; nothing is fetched. The optional town
// is stored on the phone and only used to build a search link when it is tapped.

import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useOfferStore } from '@/stores/useOfferStore';
import { NEARBY, SOCIAL_PLACES, PLACE_MAX, nearbyUrl } from '@/constants/elsewhere';
import { FONTS } from '@/constants/Colors';
import { SPACING } from '@/constants/Spacing';

function open(url: string) {
  Haptics.selectionAsync().catch(() => {});
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open that", 'Check your connection and try again.'));
}

export default function ElsewhereScreen() {
  const { colors, cardStyle } = useTheme();
  const place = useOfferStore((s) => s.place);
  const setPlace = useOfferStore((s) => s.setPlace);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Beyond the screen</Text>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={10} accessibilityLabel="Close">
          <Feather name="x" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          The point of cutting back is more life, not an empty phone. Here is where to put the time.
        </Text>

        <Text style={[styles.section, { color: colors.textMuted }]}>Near you</Text>
        <View style={[styles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Your town or neighbourhood (optional). It stays on your phone and is only added to a search when you tap a row.
          </Text>
          <TextInput
            value={place}
            onChangeText={setPlace}
            maxLength={PLACE_MAX}
            placeholder="Near me"
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            returnKeyType="done"
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          {NEARBY.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => open(nearbyUrl(n, place))}
              accessibilityRole="link"
              accessibilityLabel={n.label}
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceHigh : 'transparent' }]}
            >
              <Feather name={n.icon} size={20} color={colors.accent} style={styles.rowIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{n.label}</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>{n.sub}</Text>
              </View>
              <Feather name="external-link" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.section, { color: colors.textMuted }]}>Calmer places to be social</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          These are not endorsements, and any app can pull you in. Pick one or two, set them up the calm way, and block them here if they start to.
        </Text>
        {SOCIAL_PLACES.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => open(p.url)}
            accessibilityRole="link"
            accessibilityLabel={`${p.name}. ${p.what}`}
            style={({ pressed }) => [
              styles.card, cardStyle,
              { backgroundColor: pressed ? colors.surfaceHigh : colors.surface, borderColor: colors.cardBorder },
            ]}
          >
            <View style={styles.rowTop}>
              <Feather name={p.icon} size={20} color={colors.accent} style={styles.rowIcon} />
              <Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>{p.name}</Text>
              <Feather name="external-link" size={16} color={colors.textMuted} />
            </View>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{p.what}</Text>
            <Text style={[styles.tip, { color: colors.accent }]}>Calm setup: {p.tip}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  title:   { fontFamily: FONTS.display, fontSize: 24 },
  content: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: SPACING.huge },
  card:    { padding: SPACING.md, gap: SPACING.sm },
  body:    { fontFamily: FONTS.body, fontSize: 13, lineHeight: 19 },
  hint:    { fontFamily: FONTS.body, fontSize: 12, lineHeight: 17 },
  tip:     { fontFamily: FONTS.bodyMedium, fontSize: 12, lineHeight: 17 },
  section: { fontFamily: FONTS.bodyMedium, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: SPACING.sm },
  input:   { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontFamily: FONTS.body, fontSize: 14 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10 },
  rowTop:  { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  rowIcon: { width: 28, textAlign: 'center' },
  rowTitle:{ fontFamily: FONTS.bodyBold, fontSize: 15 },
});
