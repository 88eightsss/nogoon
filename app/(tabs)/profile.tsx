// ─── Profile Screen ───────────────────────────────────────────────────────────
//
// Shows the user's stats, level progress, achievements, and settings.
// All data comes from useUserStore (which is now persisted and synced to Supabase).
//
// Sections:
//   1. Avatar + name + level
//   2. XP progress bar
//   3. Stats grid (total games, best streak, points, sites blocked)
//   4. Achievements (locked/unlocked)
//   5. Settings (sign out)

import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore, getLevelProgress } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { AdBanner } from '@/components/ads/AdBanner';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { useState } from 'react';

// ─── Achievement definitions ──────────────────────────────────────────────────

const ACHIEVEMENTS = [
  {
    id: 'first_game',
    emoji: '🎮',
    label: 'First Game',
    desc: 'Play your first mini-game',
    check: (s: ReturnType<typeof useUserStore.getState>) =>
      s.weeklyActivity.some((n) => n > 0),
  },
  {
    id: 'streak_7',
    emoji: '🔥',
    label: '7-Day Streak',
    desc: 'Keep a 7-day streak',
    check: (s: ReturnType<typeof useUserStore.getState>) => s.longestStreak >= 7,
  },
  {
    id: 'guardian',
    emoji: '⚔️',
    label: 'Guardian',
    desc: 'Reach the Guardian level',
    check: (s: ReturnType<typeof useUserStore.getState>) =>
      ['Guardian', 'Sentinel', 'Legend'].includes(s.level),
  },
  {
    id: 'blocklist_5',
    emoji: '🛡️',
    label: 'Defender',
    desc: 'Add 5 sites to your blocklist',
    check: (s: ReturnType<typeof useUserStore.getState>) => s.blocklist.length >= 5,
  },
  {
    id: 'points_1000',
    emoji: '💰',
    label: 'Point Hoarder',
    desc: 'Accumulate 1,000 points',
    check: (s: ReturnType<typeof useUserStore.getState>) => s.points >= 1000,
  },
] as const;

// ─── Main component ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const store    = useUserStore();
  const { signOut } = useAuthStore();
  const { isPro, devModeEnabled, toggleDevMode } = useSubscriptionStore();

  const {
    name, points, xp, level, streak, longestStreak,
    weeklyActivity, blocklist,
    // Game mode
    gameMode, setGameMode,
    // BRICKED mode
    isBricked, brickedDisableRequestedAt,
    enableBricked, requestDisableBricked, confirmDisableBricked,
    // Game duration (Pro)
    gameDuration, setGameDuration,
    // Streak restores (Pro)
    streakRestoresLeft,
  } = store;

  const levelProgress = getLevelProgress(xp);
  const totalGames    = weeklyActivity.reduce((a, b) => a + b, 0);

  // Initials for the avatar circle (up to 2 characters)
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  // ── BRICKED cooldown check ──────────────────────────────────────────────────
  // After requesting disable, a 24-hour cooldown must pass.
  // This prevents impulsive disabling during a craving moment.
  const now = Date.now();
  const brickedCooldownMs = 24 * 60 * 60 * 1000; // 24 hours
  const cooldownElapsed   = brickedDisableRequestedAt
    ? now - brickedDisableRequestedAt >= brickedCooldownMs
    : false;
  const cooldownHoursLeft = brickedDisableRequestedAt
    ? Math.max(0, Math.ceil((brickedCooldownMs - (now - brickedDisableRequestedAt)) / 3600000))
    : 0;

  const handleToggleBricked = () => {
    if (!isBricked) {
      // Turning ON — show a strong warning before enabling
      Alert.alert(
        '🧱 Enable BRICKED Mode?',
        'This permanently hides the unlock button on every intercept. To turn it off you must wait 24 hours after requesting it. Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable BRICKED',
            style: 'destructive',
            onPress: () => enableBricked(),
          },
        ]
      );
    } else if (!brickedDisableRequestedAt) {
      // Start the 24hr cooldown timer
      Alert.alert(
        'Disable BRICKED Mode',
        'A 24-hour cooldown will start now. Come back tomorrow to confirm and disable it.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start Cooldown',
            onPress: () => requestDisableBricked(),
          },
        ]
      );
    } else if (cooldownElapsed) {
      // Cooldown done — allow confirmation
      Alert.alert(
        'Confirm Disable BRICKED',
        '24 hours have passed. Do you want to turn off BRICKED mode now?',
        [
          { text: 'Keep BRICKED On', style: 'cancel' },
          {
            text: 'Turn Off',
            onPress: () => confirmDisableBricked(),
          },
        ]
      );
    } else {
      // Still waiting
      Alert.alert(
        '⏳ Cooldown in Progress',
        `You requested to disable BRICKED mode. Come back in ${cooldownHoursLeft} hour${cooldownHoursLeft === 1 ? '' : 's'} to confirm.`
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Section 1: Avatar + name + level ── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitials}>{initials || '?'}</Text>
          </View>
          <Text style={styles.userName}>{name || 'Player'}</Text>
          <View style={styles.levelBadge}>
            <Text style={styles.levelBadgeText}>{level}</Text>
          </View>
        </View>

        {/* ── Section 2: XP progress bar ── */}
        <View style={styles.xpCard}>
          <View style={styles.xpHeader}>
            <Text style={styles.xpLabel}>XP Progress</Text>
            <Text style={styles.xpNumbers}>
              {xp.toLocaleString()} / {levelProgress.nextThreshold?.toLocaleString() ?? '∞'}
            </Text>
          </View>
          <View style={styles.xpTrack}>
            <View
              style={[
                styles.xpFill,
                { width: `${Math.round(levelProgress.percent * 100)}%` },
              ]}
            />
          </View>
          <View style={styles.xpFooter}>
            <Text style={styles.xpCurrentLevel}>{level}</Text>
            {levelProgress.nextLabel && (
              <Text style={styles.xpNextLevel}>{levelProgress.nextLabel} →</Text>
            )}
          </View>
        </View>

        {/* ── Section 3: Stats grid ── */}
        <View style={styles.statsGrid}>
          <StatCell label="Total Games" value={String(totalGames)} color={COLORS.green} />
          <StatCell label="Best Streak" value={`${longestStreak}d`} color={COLORS.warning} />
          <StatCell label="Points" value={points.toLocaleString()} color={COLORS.purple} />
          <StatCell label="Sites Blocked" value={String(blocklist.length)} color={COLORS.cyan} />
        </View>

        {/* ── Section 4: Achievements ── */}
        <Text style={styles.sectionHeader}>Achievements</Text>
        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.map((a) => {
            const earned = a.check(store);
            return (
              <View
                key={a.id}
                style={[styles.achievementCard, !earned && styles.achievementLocked]}
              >
                <Text style={styles.achievementEmoji}>{a.emoji}</Text>
                <Text style={[styles.achievementLabel, !earned && styles.achievementLockedText]}>
                  {a.label}
                </Text>
                <Text style={styles.achievementDesc}>{a.desc}</Text>
                {earned && (
                  <View style={styles.earnedBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.green} />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Section 5: Settings ── */}
        <Text style={styles.sectionHeader}>Settings</Text>

        {/* Subscription status + upgrade button */}
        {isPro ? (
          <View style={styles.proActiveBanner}>
            <Ionicons name="shield-checkmark" size={18} color={COLORS.purple} />
            <Text style={styles.proActiveText}>NoGoon Pro · Active</Text>
          </View>
        ) : (
          <Pressable
            style={styles.upgradeButton}
            onPress={() => router.push('/paywall')}
          >
            <View style={styles.upgradeLeft}>
              <Ionicons name="flash" size={18} color={COLORS.purple} />
              <View>
                <Text style={styles.upgradeTitle}>Upgrade to NoGoon Pro</Text>
                <Text style={styles.upgradeSubtitle}>
                  $2.88/month · Unlimited unlocks
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.purple + 'aa'} />
          </Pressable>
        )}

        <View style={styles.settingsCard}>

          {/* ── Game mode toggle ── */}
          {/* 'random' = a game launches immediately on intercept (no picker shown)
              'choose' = user picks which game they want (default) */}
          <View style={styles.settingsRow}>
            <Ionicons name="game-controller-outline" size={20} color={COLORS.cyan} />
            <View style={styles.settingsRowMiddle}>
              <Text style={styles.settingsRowText}>Random Game Mode</Text>
              <Text style={styles.settingsRowSub}>
                {gameMode === 'random'
                  ? 'A game launches instantly on intercept'
                  : 'You choose which game to play'}
              </Text>
            </View>
            <Switch
              value={gameMode === 'random'}
              onValueChange={(val) => setGameMode(val ? 'random' : 'choose')}
              trackColor={{ false: COLORS.border, true: COLORS.cyan + '55' }}
              thumbColor={gameMode === 'random' ? COLORS.cyan : COLORS.textMuted}
            />
          </View>

          <View style={styles.settingsDivider} />

          {/* ── BRICKED mode toggle ── */}
          {/* BRICKED = Hard Mode. Hides the unlock button on every intercept screen.
              Turning it off requires a 24-hour cooldown to prevent craving-moment disabling. */}
          <View style={styles.settingsRow}>
            <Text style={{ fontSize: 20 }}>🧱</Text>
            <View style={styles.settingsRowMiddle}>
              <Text style={[styles.settingsRowText, isBricked && { color: COLORS.warning }]}>
                BRICKED Mode
              </Text>
              <Text style={styles.settingsRowSub}>
                {!isBricked
                  ? 'Hides the unlock button on every intercept'
                  : brickedDisableRequestedAt
                    ? cooldownElapsed
                      ? 'Cooldown done — tap to confirm disable'
                      : `Cooldown active — ${cooldownHoursLeft}h left to disable`
                    : 'Active — tap to start 24h disable cooldown'}
              </Text>
            </View>
            <Switch
              value={isBricked}
              onValueChange={handleToggleBricked}
              trackColor={{ false: COLORS.border, true: COLORS.warning + '55' }}
              thumbColor={isBricked ? COLORS.warning : COLORS.textMuted}
            />
          </View>

          <View style={styles.settingsDivider} />

          {/* ── Game duration (Pro only) ── */}
          {/* Controls how long each mini-game lasts. Default 30s, Pro can extend. */}
          {isPro ? (
            <>
              <View style={styles.settingsRow}>
                <Ionicons name="timer-outline" size={20} color={COLORS.purple} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={styles.settingsRowText}>Game Duration</Text>
                  <Text style={styles.settingsRowSub}>
                    How long each challenge lasts
                  </Text>
                </View>
              </View>
              {/* Duration pill row */}
              <View style={styles.durationRow}>
                {([30, 60, 90] as const).map((d) => (
                  <Pressable
                    key={d}
                    style={[
                      styles.durationPill,
                      gameDuration === d && styles.durationPillActive,
                    ]}
                    onPress={() => setGameDuration(d)}
                  >
                    <Text
                      style={[
                        styles.durationPillText,
                        gameDuration === d && styles.durationPillTextActive,
                      ]}
                    >
                      {d}s
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.settingsDivider} />
            </>
          ) : (
            // Free users see a locked row that routes to paywall
            <>
              <Pressable
                style={styles.settingsRow}
                onPress={() => router.push('/paywall')}
              >
                <Ionicons name="timer-outline" size={20} color={COLORS.textMuted} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={[styles.settingsRowText, { color: COLORS.textMuted }]}>
                    Game Duration
                  </Text>
                  <Text style={styles.settingsRowSub}>Pro — 30/60/90 second games</Text>
                </View>
                <Ionicons name="lock-closed" size={14} color={COLORS.textMuted} />
              </Pressable>
              <View style={styles.settingsDivider} />
            </>
          )}

          {/* ── Streak restores (Pro only) ── */}
          {isPro && (
            <>
              <View style={styles.settingsRow}>
                <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.purple} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={styles.settingsRowText}>Streak Protection</Text>
                  <Text style={styles.settingsRowSub}>
                    {streakRestoresLeft > 0
                      ? `${streakRestoresLeft} restore available this month`
                      : 'Used this month — resets next month'}
                  </Text>
                </View>
              </View>
              <View style={styles.settingsDivider} />
            </>
          )}

          {/* ── Accountability partner (Pro only) ── */}
          {isPro ? (
            <>
              <Pressable
                style={styles.settingsRow}
                onPress={() => router.push('/partner')}
              >
                <Ionicons name="people-outline" size={20} color={COLORS.cyan} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={styles.settingsRowText}>Accountability Partner</Text>
                  <Text style={styles.settingsRowSub}>
                    Set up a partner to keep you honest
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </Pressable>
              <View style={styles.settingsDivider} />
            </>
          ) : (
            <>
              <Pressable
                style={styles.settingsRow}
                onPress={() => router.push('/paywall')}
              >
                <Ionicons name="people-outline" size={20} color={COLORS.textMuted} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={[styles.settingsRowText, { color: COLORS.textMuted }]}>
                    Accountability Partner
                  </Text>
                  <Text style={styles.settingsRowSub}>Pro — notify someone when you slip</Text>
                </View>
                <Ionicons name="lock-closed" size={14} color={COLORS.textMuted} />
              </Pressable>
              <View style={styles.settingsDivider} />
            </>
          )}

          {/* ── Impulse journal ── */}
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push('/journal')}
          >
            <Ionicons name="journal-outline" size={20} color={COLORS.green} />
            <View style={styles.settingsRowMiddle}>
              <Text style={styles.settingsRowText}>Impulse Journal</Text>
              <Text style={styles.settingsRowSub}>
                Review your past intercept entries
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </Pressable>

          <View style={styles.settingsDivider} />

          {/* ── Weekly insights (Pro) ── */}
          {isPro ? (
            <>
              <Pressable
                style={styles.settingsRow}
                onPress={() => router.push('/insights')}
              >
                <Ionicons name="bar-chart-outline" size={20} color={COLORS.purple} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={styles.settingsRowText}>Weekly Insights</Text>
                  <Text style={styles.settingsRowSub}>
                    Deep stats on your blocking patterns
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
              </Pressable>
              <View style={styles.settingsDivider} />
            </>
          ) : null}

          {/* ── Sign out ── */}
          <Pressable style={styles.settingsRow} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
            <Text style={[styles.settingsRowText, { color: COLORS.danger }]}>Sign Out</Text>
          </Pressable>
        </View>

        {/* ── Developer Mode card ───────────────────────────────────────────────
            Hidden testing panel. Toggle this ON to simulate a Pro subscription
            so you can test every feature without paying.
            Always turn OFF before sharing the app with real users. */}
        <View style={styles.devCard}>
          <View style={styles.devHeader}>
            <Text style={styles.devTitle}>🛠️ Developer Mode</Text>
            <Switch
              value={devModeEnabled}
              onValueChange={toggleDevMode}
              trackColor={{ false: COLORS.border, true: COLORS.warning + '77' }}
              thumbColor={devModeEnabled ? COLORS.warning : COLORS.textMuted}
            />
          </View>
          <Text style={styles.devDesc}>
            {devModeEnabled
              ? '✅ Pro features UNLOCKED — all gates bypassed for testing.'
              : 'Turn on to simulate a Pro subscription and test all features.'}
          </Text>
          {devModeEnabled && (
            <View style={styles.devActiveRow}>
              <Ionicons name="warning-outline" size={14} color={COLORS.warning} />
              <Text style={styles.devWarning}>
                Turn OFF before publishing to real users
              </Text>
            </View>
          )}
        </View>

        {/* Ad banner — visible to free users at the bottom of their profile */}
        <AdBanner size="banner" style={{ marginTop: SPACING.md }} />

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── StatCell sub-component ────────────────────────────────────────────────────

function StatCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.md,
  },

  // ── Developer mode card ────────────────────────────────────────────────────
  devCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: COLORS.warning + '10',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.warning + '30',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  devHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  devTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.warning,
  },
  devDesc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  devActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  devWarning: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.warning,
  },

  // ── Avatar ──
  avatarSection: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.greenDim,
    borderWidth: 2,
    borderColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  avatarInitials: {
    fontFamily: FONTS.display,
    fontSize: 30,
    color: COLORS.green,
  },
  userName: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  levelBadge: {
    backgroundColor: COLORS.purpleDim,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.purple + '55',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  levelBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.purple,
    letterSpacing: 1,
  },

  // ── XP card ──
  xpCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  xpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  xpLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  xpNumbers: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  xpTrack: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: COLORS.purple,
    borderRadius: RADIUS.full,
  },
  xpFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xpCurrentLevel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.purple,
  },
  xpNextLevel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // ── Stats grid ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  statCell: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 28,
  },
  statLabel: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // ── Section headers ──
  sectionHeader: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: SPACING.sm,
  },

  // ── Achievements ──
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  achievementCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.md,
    gap: 4,
    position: 'relative',
  },
  achievementLocked: { opacity: 0.4 },
  achievementEmoji: { fontSize: 24, marginBottom: 2 },
  achievementLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  achievementLockedText: { color: COLORS.textMuted },
  achievementDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    color: COLORS.textMuted,
    lineHeight: 16,
  },
  earnedBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },

  // ── Settings ──
  settingsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  settingsRowMiddle: {
    flex: 1,
    gap: 2,
  },
  settingsRowText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
  },
  settingsRowSub: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
  },

  // ── Game duration pills (Pro) ──
  durationRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  durationPill: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  durationPillActive: {
    backgroundColor: COLORS.purpleDim,
    borderColor: COLORS.purple + '66',
  },
  durationPillText: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    color: COLORS.textMuted,
  },
  durationPillTextActive: {
    color: COLORS.purple,
  },

  // ── Pro / Upgrade ──
  proActiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.purpleDim,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.purple + '44',
    padding: SPACING.md,
  },
  proActiveText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 14,
    color: COLORS.purple,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.purpleDim,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.purple + '55',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  upgradeLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  upgradeTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: COLORS.purple,
  },
  upgradeSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 1,
  },
});
