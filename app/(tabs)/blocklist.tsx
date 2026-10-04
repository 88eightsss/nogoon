// ─── Protect Screen ────────────────────────────────────────────────────────────
//
// Layout:
//   1. Block apps — per-app toggles
//   2. Quick blocks — collapsible site packages
//   3. Add your own — custom domain input

import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  StyleSheet, Switch, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useUserStore } from '@/stores/useUserStore';
import { useAppBlocker, BLOCKABLE_APPS } from '@/hooks/useAppBlocker';
import { describeBlockingStatus } from '@/utils/blockingStatus';
import { PulseGlow } from '@/components/PulseGlow';
import { useTheme } from '@/hooks/useTheme';
import { PageGuide } from '@/components/PageGuide';
import { ProtectionBanner } from '@/components/ProtectionBanner';
import { FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Site packages ────────────────────────────────────────────────────────────

type SitePackage = {
  id:    string;
  name:  string;
  emoji: string;
  sites: string[];
};

const PACKAGES: SitePackage[] = [
  {
    id:    'social',
    name:  'Social & Entertainment',
    emoji: '📱',
    sites: [
      'instagram.com', 'tiktok.com', 'youtube.com', 'twitter.com',
      'facebook.com', 'snapchat.com', 'pinterest.com', 'twitch.tv',
      'reddit.com', 'discord.com',
    ],
  },
  {
    id:    'news',
    name:  'News & Browsing',
    emoji: '🗞️',
    sites: [
      'cnn.com', 'foxnews.com', 'reddit.com', 'news.google.com',
      'bbc.com', 'twitter.com', 'apple.news', 'huffpost.com',
      'nytimes.com', 'theguardian.com',
    ],
  },
  {
    id:    'shopping',
    name:  'Shopping & Streaming',
    emoji: '🛒',
    sites: [
      'amazon.com', 'netflix.com', 'hulu.com', 'disneyplus.com',
      'hbomax.com', 'ebay.com', 'wish.com', 'shein.com',
      'spotify.com', 'primevideo.com',
    ],
  },
];

// ─── Package row ──────────────────────────────────────────────────────────────

function PackageRow({ pkg, blocklist, onAddSite, onRemoveSite }: {
  pkg: SitePackage;
  blocklist: string[];
  onAddSite: (domain: string) => void;
  onRemoveSite: (domain: string) => void;
}) {
  const { colors, cardStyle } = useTheme();
  const [open, setOpen] = useState(false);

  const blocked = pkg.sites.filter((s) => blocklist.includes(s));
  const allBlocked = blocked.length === pkg.sites.length;

  const toggleAll = () => {
    if (allBlocked) {
      pkg.sites.forEach(onRemoveSite);
    } else {
      pkg.sites.forEach((s) => { if (!blocklist.includes(s)) onAddSite(s); });
    }
  };

  return (
    <View style={[pkgStyles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      {/* Header row */}
      <Pressable style={pkgStyles.header} onPress={() => setOpen((v) => !v)}>
        <Text style={pkgStyles.emoji}>{pkg.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[pkgStyles.name, { color: colors.text }]}>{pkg.name}</Text>
          <Text style={[pkgStyles.count, { color: colors.textMuted }]}>
            {blocked.length}/{pkg.sites.length} blocked
          </Text>
        </View>
        <Switch
          value={allBlocked}
          onValueChange={toggleAll}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#fff"
        />
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textMuted}
          style={{ marginLeft: SPACING.sm }}
        />
      </Pressable>

      {/* Expanded site list */}
      {open && (
        <View style={[pkgStyles.siteList, { borderTopColor: colors.border }]}>
          {pkg.sites.map((site) => {
            const isBlocked = blocklist.includes(site);
            return (
              <View key={site} style={pkgStyles.siteRow}>
                <Text style={[pkgStyles.siteName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {site}
                </Text>
                <Switch
                  value={isBlocked}
                  onValueChange={(val) => val ? onAddSite(site) : onRemoveSite(site)}
                  trackColor={{ false: colors.border, true: colors.accent }}
                  thumbColor="#fff"
                />
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const pkgStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  emoji: { fontSize: 20, width: 28 },
  name: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
  },
  count: {
    fontFamily: FONTS.body,
    fontSize: 11,
    marginTop: 1,
  },
  siteList: {
    borderTopWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  siteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  siteName: {
    fontFamily: FONTS.body,
    fontSize: 13,
    flex: 1,
    marginRight: SPACING.md,
  },
});

// ─── Custom site toggle ───────────────────────────────────────────────────────

function CustomSiteRow({ domain, onRemove }: { domain: string; onRemove: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[customStyles.row, { borderBottomColor: colors.border }]}>
      <Feather name="shield" size={14} color={colors.accent} />
      <Text style={[customStyles.text, { color: colors.text }]} numberOfLines={1}>{domain}</Text>
      <Pressable onPress={onRemove} hitSlop={10}>
        <Feather name="x" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const customStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  text: {
    fontFamily: FONTS.body,
    fontSize: 13,
    flex: 1,
  },
});

// ─── Protect screen ───────────────────────────────────────────────────────────

export default function ProtectScreen() {
  const { colors, cardStyle } = useTheme();
  const { blocklist, addSite, removeSite, blockedApps, setBlockedApps } = useUserStore();
  const { blockingStatus, openSettings } = useAppBlocker();
  const statusView = describeBlockingStatus(blockingStatus, colors);

  const [customInput, setCustomInput] = useState('');

  // Sites that are in blocklist but NOT from any package
  const packageSites = PACKAGES.flatMap((p) => p.sites);
  const customSites = [...new Set(blocklist.filter((d) => !packageSites.includes(d)))];

  const submitCustom = useCallback(() => {
    const val = customInput
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();
    if (!val) return;
    addSite(val);
    setCustomInput('');
  }, [customInput, addSite]);

  const toggleApp = useCallback((pkg: string, enabled: boolean) => {
    if (enabled) {
      setBlockedApps([...blockedApps, pkg]);
    } else {
      setBlockedApps(blockedApps.filter((p) => p !== pkg));
    }
  }, [blockedApps, setBlockedApps]);

  return (
    <>
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Protect</Text>
            {statusView.visible && (
              <PulseGlow active={statusView.alarm} color={statusView.color} radius={20}>
                <Pressable
                  style={[styles.statusPill, { backgroundColor: statusView.dim }]}
                  onPress={statusView.alarm ? openSettings : undefined}
                >
                  <Feather name={statusView.icon} size={12} color={statusView.color} />
                  <Text style={[styles.statusText, { color: statusView.color }]}>{statusView.short}</Text>
                </Pressable>
              </PulseGlow>
            )}
          </View>

          {/* Battery-exemption warning — catches the state the pill above can't see */}
          <ProtectionBanner />

          {/* Section: Apps — shown first */}
          {BLOCKABLE_APPS.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Block apps</Text>
              <View style={[addStyles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                {BLOCKABLE_APPS.map((app, i) => (
                  <View
                    key={app.id}
                    style={[
                      appStyles.row,
                      { borderBottomColor: colors.border, borderBottomWidth: i < BLOCKABLE_APPS.length - 1 ? 1 : 0 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[appStyles.name, { color: colors.text }]}>{app.name}</Text>
                    </View>
                    <Switch
                      value={blockedApps.includes(app.id)}
                      onValueChange={(val) => toggleApp(app.id, val)}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor="#fff"
                    />
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Section: Packages */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Quick blocks</Text>

          {PACKAGES.map((pkg) => (
            <PackageRow
              key={pkg.id}
              pkg={pkg}
              blocklist={blocklist}
              onAddSite={addSite}
              onRemoveSite={removeSite}
            />
          ))}

          {/* Section: Add your own */}
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Add your own</Text>

          <View style={[addStyles.card, cardStyle, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <View style={addStyles.inputRow}>
              <TextInput
                style={[addStyles.input, { color: colors.text }]}
                value={customInput}
                onChangeText={setCustomInput}
                placeholder="website, e.g. reddit.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={submitCustom}
              />
              <Pressable
                style={[addStyles.addBtn, { backgroundColor: customInput.trim() ? colors.accent : colors.accentDim }]}
                onPress={submitCustom}
                disabled={!customInput.trim()}
              >
                <Feather name="plus" size={16} color="#fff" />
              </Pressable>
            </View>

            {/* Custom site list */}
            {customSites.length > 0 && (
              <View style={[addStyles.list, { borderTopColor: colors.border }]}>
                {customSites.map((d, i) => (
                  <CustomSiteRow key={`${d}-${i}`} domain={d} onRemove={() => removeSite(d)} />
                ))}
              </View>
            )}
          </View>

          {/* AI teaser */}
          <View style={[teaserStyles.wrap, { backgroundColor: colors.accentDim }]}>
            <Text style={[teaserStyles.text, { color: colors.accent }]}>
              ✦ AI suggestions coming soon — it'll learn what to block based on your patterns
            </Text>
          </View>

          <View style={{ height: SPACING.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    <PageGuide
      page="blocklist"
      icon="shield"
      accent={colors.protect}
      title="Protect"
      hint="What gets blocked"
      subtitle="Choose what NoGoon steps in for."
      points={[
        { icon: 'toggle-right', title: 'Per-app toggles',   body: 'Flip on the apps you struggle with.' },
        { icon: 'package',      title: 'Quick blocks',      body: 'Block a whole category in one tap.' },
        { icon: 'plus-circle',  title: 'Add your own',      body: 'Type in any site that isn\'t listed.' },
      ]}
    />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.xs,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 22,
    letterSpacing: -0.3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  statusText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
  },
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: SPACING.xs,
    marginBottom: -SPACING.xs,
  },
});

const addStyles = StyleSheet.create({
  card: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    borderTopWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
});

const teaserStyles = StyleSheet.create({
  wrap: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  text: {
    fontFamily: FONTS.body,
    fontSize: 12,
    lineHeight: 18,
  },
});

const appStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  name: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
  },
});
