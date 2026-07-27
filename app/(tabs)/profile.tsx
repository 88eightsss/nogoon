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

import { View, Text, Pressable, ScrollView, StyleSheet, Alert, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useUserStore, getLevelProgress } from '@/stores/useUserStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import { useAppBlocker } from '@/hooks/useAppBlocker';
import { AdBanner } from '@/components/ads/AdBanner';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Achievement definitions ──────────────────────────────────────────────────

const ACHIEVEMENTS = [
  {
    id: 'first_game',
    emoji: '🎮',
    label: 'First Rep',
    desc: 'Play your first mini-game',
    check: (s: ReturnType<typeof useUserStore.getState>) =>
      s.weeklyActivity.some((n) => n > 0),
  },
  {
    id: 'first_walkaway',
    emoji: '🚶',
    label: 'First Walk-Away',
    desc: 'Walk away from a blocked site after playing',
    check: (s: ReturnType<typeof useUserStore.getState>) => s.walkAwayCount >= 1,
  },
  {
    id: 'walkaway_10',
    emoji: '💪',
    label: 'Resilient',
    desc: 'Walk away 10 times',
    check: (s: ReturnType<typeof useUserStore.getState>) => s.walkAwayCount >= 10,
  },
  {
    id: 'walkaway_25',
    emoji: '🧠',
    label: 'Rewired',
    desc: 'Walk away 25 times',
    check: (s: ReturnType<typeof useUserStore.getState>) => s.walkAwayCount >= 25,
  },
  {
    id: 'games_10',
    emoji: '⚡',
    label: '10 Games',
    desc: 'Play 10 mini-games total',
    check: (s: ReturnType<typeof useUserStore.getState>) =>
      s.gamesPlayed >= 10,
  },
  {
    id: 'games_50',
    emoji: '🏆',
    label: '50 Games',
    desc: 'Play 50 mini-games total',
    check: (s: ReturnType<typeof useUserStore.getState>) =>
      s.gamesPlayed >= 50,
  },
  {
    id: 'streak_7',
    emoji: '🔥',
    label: '7-Day Streak',
    desc: 'Keep a 7-day streak',
    check: (s: ReturnType<typeof useUserStore.getState>) => s.longestStreak >= 7,
  },
  {
    id: 'streak_30',
    emoji: '🌙',
    label: '30-Day Streak',
    desc: 'Keep a 30-day streak',
    check: (s: ReturnType<typeof useUserStore.getState>) => s.longestStreak >= 30,
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
] as const;

// ─── Main component ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const store    = useUserStore();
  const { signOut } = useAuthStore();
  const { isPro, devModeEnabled, toggleDevMode } = useSubscriptionStore();
  const { grayscaleEnabled, setGrayscaleEnabled } = useAppBlocker();

  const {
    name, points, xp, level, streak, longestStreak,
    weeklyActivity, blocklist, walkAwayCount,
    // Game mode
    gameMode, setGameMode,
    // No-Games mode
    noGames, setNoGames,
    // Daily intention
    dailyIntention, intentionDate, setDailyIntention,
    // Wind-down mode
    windDownEnabled, setWindDownEnabled, windDownHour, setWindDownHour,
    // Block schedule
    blockScheduleEnabled, blockScheduleStart, blockScheduleEnd, blockScheduleDays, setBlockSchedule,
    // Focus session
    focusSessionEnd, startFocusSession, endFocusSession,
    // BRICKED mode
    isBricked, brickedDisableRequestedAt,
    enableBricked, requestDisableBricked, confirmDisableBricked,
    // Game duration (Pro)
    gameDuration, setGameDuration,
    // Streak restores (Pro)
    streakRestoresLeft,
  } = store;

  const C = COLORS;

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
    <SafeAreaView style={[styles.safe, { backgroundColor: C.background }]}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: C.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Section 1: Avatar + name + level ── */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatarCircle, { backgroundColor: C.greenDim, borderColor: C.indigoBright }]}>
            <Text style={[styles.avatarInitials, { color: C.indigoBright }]}>{initials || '?'}</Text>
          </View>
          <Text style={[styles.userName, { color: C.textPrimary }]}>{name || 'Player'}</Text>
          <View style={[styles.levelBadge, { backgroundColor: C.purpleDim, borderColor: C.purple + '55' }]}>
            <Text style={[styles.levelBadgeText, { color: C.purple }]}>{level}</Text>
          </View>
        </View>

        {/* ── Section 2: XP progress bar ── */}
        <View style={[styles.xpCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
          <View style={styles.xpHeader}>
            <Text style={[styles.xpLabel, { color: C.textSecondary }]}>XP Progress</Text>
            <Text style={[styles.xpNumbers, { color: C.textMuted }]}>
              {xp.toLocaleString()} / {levelProgress.nextThreshold?.toLocaleString() ?? '∞'}
            </Text>
          </View>
          <View style={[styles.xpTrack, { backgroundColor: C.border }]}>
            <View
              style={[
                styles.xpFill,
                { width: `${Math.round(levelProgress.percent * 100)}%` },
              ]}
            />
          </View>
          <View style={styles.xpFooter}>
            <Text style={[styles.xpCurrentLevel, { color: C.purple }]}>{level}</Text>
            {levelProgress.nextLabel && (
              <Text style={[styles.xpNextLevel, { color: C.textMuted }]}>{levelProgress.nextLabel} →</Text>
            )}
          </View>
        </View>

        {/* ── Walk-Away Hero — the metric that never resets ── */}
        <View style={[styles.walkAwayHero, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
          <View style={styles.walkAwayLeft}>
            <Text style={[styles.walkAwayNumber, { color: C.cyan }]}>
              {walkAwayCount.toLocaleString()}
            </Text>
            <Text style={[styles.walkAwayLabel, { color: C.textSecondary }]}>times you walked away</Text>
            <Text style={[styles.walkAwayCaption, { color: C.textMuted }]}>every win counts — never resets</Text>
          </View>
          <Feather name="trending-up" size={36} color={C.cyan + '33'} />
        </View>

        {/* ── Section 3: Stats grid ── */}
        <View style={styles.statsGrid}>
          <StatCell label="Total Games" value={String(totalGames)} color={C.green} C={C} />
          <StatCell label="Best Streak" value={`${longestStreak}d`} color={C.warning} C={C} />
          <StatCell label="Points" value={points.toLocaleString()} color={C.purple} C={C} />
          <StatCell label="Sites Blocked" value={String(blocklist.length)} color={C.cyan} C={C} />
        </View>

        {/* ── Section 4: Achievements ── */}
        <Text style={[styles.sectionHeader, { color: C.textSecondary }]}>Achievements</Text>
        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.map((a) => {
            const earned = a.check(store);
            return (
              <View
                key={a.id}
                style={[styles.achievementCard, { backgroundColor: C.surface, borderColor: C.cardBorder }, !earned && styles.achievementLocked]}
              >
                <Text style={styles.achievementEmoji}>{a.emoji}</Text>
                <Text style={[styles.achievementLabel, { color: C.textPrimary }, !earned && { color: C.textMuted }]}>
                  {a.label}
                </Text>
                <Text style={styles.achievementDesc}>{a.desc}</Text>
                {earned && (
                  <View style={styles.earnedBadge}>
                    <Feather name="check-circle" size={14} color={C.green} />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Section 5: Settings ── */}
        <Text style={[styles.sectionHeader, { color: C.textSecondary }]}>Settings</Text>

        {/* Subscription status + upgrade button */}
        {isPro ? (
          <View style={[styles.proActiveBanner, { backgroundColor: C.purpleDim, borderColor: C.purple + '44' }]}>
            <Feather name="check-circle" size={18} color={C.purple} />
            <Text style={[styles.proActiveText, { color: C.purple }]}>NoGoon Pro · Active</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.upgradeButton, { backgroundColor: C.purpleDim, borderColor: C.purple + '55' }]}
            onPress={() => router.push('/paywall')}
          >
            <View style={styles.upgradeLeft}>
              <Feather name="zap" size={18} color={C.purple} />
              <View>
                <Text style={[styles.upgradeTitle, { color: C.purple }]}>Upgrade to NoGoon Pro</Text>
                <Text style={[styles.upgradeSubtitle, { color: C.textMuted }]}>
                  $4.22/month · Warp, Why Am I Here? + more
                </Text>
              </View>
            </View>
            <Feather name="chevron-right" size={18} color={C.purple + 'aa'} />
          </Pressable>
        )}

        <View style={[styles.settingsCard, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>

          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── Game mode toggle ── */}
          {/* 'random' = a game launches immediately on intercept (no picker shown)
              'choose' = user picks which game they want (default) */}
          <View style={styles.settingsRow}>
            <Feather name="zap" size={20} color={C.cyan} />
            <View style={styles.settingsRowMiddle}>
              <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Random Game Mode</Text>
              <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                {gameMode === 'random'
                  ? 'A game launches instantly on intercept'
                  : 'You choose which game to play'}
              </Text>
            </View>
            <Switch
              value={gameMode === 'random'}
              onValueChange={(val) => setGameMode(val ? 'random' : 'choose')}
              trackColor={{ false: C.border, true: C.cyan + '55' }}
              thumbColor={gameMode === 'random' ? C.cyan : C.textMuted}
            />
          </View>

          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── No-Games mode toggle ── */}
          {/* When on, the gate skips the game entirely — just pause + exit.
              Useful for users who find the game requirement frustrating but still
              want the 3-second calm pause before opening a blocked site. */}
          <View style={styles.settingsRow}>
            <Text style={{ fontSize: 20 }}>🚪</Text>
            <View style={styles.settingsRowMiddle}>
              <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>No-Game Mode</Text>
              <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                {noGames
                  ? 'Gate pauses, then lets you close the app yourself'
                  : 'Gate requires a game before you can proceed'}
              </Text>
            </View>
            <Switch
              value={noGames}
              onValueChange={setNoGames}
              trackColor={{ false: C.border, true: C.green + '55' }}
              thumbColor={noGames ? C.green : C.textMuted}
            />
          </View>

          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── Daily intention ── */}
          {/* One sentence set each morning. Gate echoes it back as a reminder. */}
          <View style={styles.settingsRow}>
            <Text style={{ fontSize: 20 }}>🌅</Text>
            <View style={[styles.settingsRowMiddle, { gap: 6 }]}>
              <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Daily Intention</Text>
              <TextInput
                style={[styles.intentionInput, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
                value={dailyIntention}
                onChangeText={setDailyIntention}
                placeholder="Today I want to..."
                placeholderTextColor={C.textMuted}
                maxLength={80}
                returnKeyType="done"
                autoCorrect={false}
              />
              {intentionDate ? (
                <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                  Set {intentionDate === new Date().toISOString().split('T')[0] ? 'today' : `on ${intentionDate}`}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── Wind-down mode ── */}
          {/* After the set hour, gate defaults to breathing game + softer tone */}
          <View style={styles.settingsRow}>
            <Text style={{ fontSize: 20 }}>🌙</Text>
            <View style={styles.settingsRowMiddle}>
              <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Wind-Down Mode</Text>
              <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                {windDownEnabled
                  ? `After ${windDownHour}:00, gate defaults to breathing`
                  : 'Softer gate after a set hour each night'}
              </Text>
              {windDownEnabled && (
                <View style={styles.windDownHourRow}>
                  {[20, 21, 22, 23].map((h) => (
                    <Pressable
                      key={h}
                      style={[
                        styles.windDownHourPill,
                        {
                          backgroundColor: windDownHour === h ? C.purple + '33' : C.surface,
                          borderColor: windDownHour === h ? C.purple : C.border,
                        },
                      ]}
                      onPress={() => setWindDownHour(h)}
                    >
                      <Text style={[styles.windDownHourText, { color: windDownHour === h ? C.purple : C.textMuted }]}>
                        {h}:00
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <Switch
              value={windDownEnabled}
              onValueChange={setWindDownEnabled}
              trackColor={{ false: C.border, true: C.purple + '55' }}
              thumbColor={windDownEnabled ? C.purple : C.textMuted}
            />
          </View>

          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── Block schedule ── */}
          {/* Only block during certain hours — e.g. work hours or before bed */}
          <View style={styles.settingsRow}>
            <Text style={{ fontSize: 20 }}>⏰</Text>
            <View style={[styles.settingsRowMiddle, { gap: 6 }]}>
              <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Block Schedule</Text>
              <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                {blockScheduleEnabled
                  ? `Active ${blockScheduleStart} – ${blockScheduleEnd}`
                  : 'Block only during certain hours'}
              </Text>
              {blockScheduleEnabled && (
                <>
                <View style={styles.scheduleTimeRow}>
                  <View style={styles.scheduleTimeField}>
                    <Text style={[styles.scheduleTimeLabel, { color: C.textMuted }]}>FROM</Text>
                    <TextInput
                      style={[styles.scheduleTimeInput, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
                      value={blockScheduleStart}
                      onChangeText={(v) => setBlockSchedule(blockScheduleEnabled, v, blockScheduleEnd, blockScheduleDays)}
                      placeholder="22:00"
                      placeholderTextColor={C.textMuted}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                      returnKeyType="done"
                    />
                  </View>
                  <Text style={[styles.scheduleTimeSep, { color: C.textMuted }]}>→</Text>
                  <View style={styles.scheduleTimeField}>
                    <Text style={[styles.scheduleTimeLabel, { color: C.textMuted }]}>TO</Text>
                    <TextInput
                      style={[styles.scheduleTimeInput, { backgroundColor: C.surface, borderColor: C.border, color: C.textPrimary }]}
                      value={blockScheduleEnd}
                      onChangeText={(v) => setBlockSchedule(blockScheduleEnabled, blockScheduleStart, v, blockScheduleDays)}
                      placeholder="08:00"
                      placeholderTextColor={C.textMuted}
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                      returnKeyType="done"
                    />
                  </View>
                </View>

                {/* Day-of-week picker — sits below the FROM→TO row */}
                <View style={styles.dayPickerRow}>
                  {['S','M','T','W','T','F','S'].map((label, i) => {
                    const active = blockScheduleDays.length === 0 || blockScheduleDays.includes(i);
                    return (
                      <Pressable
                        key={i}
                        style={[
                          styles.dayChip,
                          { backgroundColor: active ? C.cyan + '22' : C.surface, borderColor: active ? C.cyan : C.border },
                        ]}
                        onPress={() => {
                          const current = blockScheduleDays.length === 0 ? [0,1,2,3,4,5,6] : [...blockScheduleDays];
                          const next = current.includes(i) ? current.filter(d => d !== i) : [...current, i].sort();
                          // If all 7 days selected, store as empty (= every day)
                          setBlockSchedule(blockScheduleEnabled, blockScheduleStart, blockScheduleEnd, next.length === 7 ? [] : next);
                        }}
                      >
                        <Text style={[styles.dayChipText, { color: active ? C.cyan : C.textMuted }]}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                </>
              )}
            </View>
            <Switch
              value={blockScheduleEnabled}
              onValueChange={(val) => setBlockSchedule(val, blockScheduleStart, blockScheduleEnd, blockScheduleDays)}
              trackColor={{ false: C.border, true: C.cyan + '55' }}
              thumbColor={blockScheduleEnabled ? C.cyan : C.textMuted}
            />
          </View>

          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── BRICKED mode toggle ── */}
          {/* BRICKED = Hard Mode. Hides the unlock button on every intercept screen.
              Turning it off requires a 24-hour cooldown to prevent craving-moment disabling. */}
          <View style={styles.settingsRow}>
            <Text style={{ fontSize: 20 }}>🧱</Text>
            <View style={styles.settingsRowMiddle}>
              <Text style={[styles.settingsRowText, { color: C.textPrimary }, isBricked && { color: C.warning }]}>
                BRICKED Mode
              </Text>
              <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
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
              trackColor={{ false: C.border, true: C.warning + '55' }}
              thumbColor={isBricked ? C.warning : C.textMuted}
            />
          </View>

          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── Grayscale / dopamine-reduction overlay ── */}
          {/* When ON: a dark overlay dims the screen for ~1.5s the instant a
              blocked app or site is detected — before the gate even appears.
              Breaks the browsing trance and signals "NoGoon stepped in."
              Note: this dims the screen; for true phone-wide grayscale go to
              Accessibility Settings → Color Correction → Grayscale. */}
          <View style={styles.settingsRow}>
            <Text style={{ fontSize: 20 }}>🔲</Text>
            <View style={styles.settingsRowMiddle}>
              <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Dim on Block</Text>
              <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                {grayscaleEnabled
                  ? 'Screen dims instantly when a blocked site is detected'
                  : 'Flash a dark overlay when NoGoon intercepts'}
              </Text>
            </View>
            <Switch
              value={grayscaleEnabled}
              onValueChange={setGrayscaleEnabled}
              trackColor={{ false: C.border, true: C.textMuted + '55' }}
              thumbColor={grayscaleEnabled ? C.textPrimary : C.textMuted}
            />
          </View>

          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── Focus session ── */}
          {/* Hard-lock for a set period: no game bypass, just a wall. */}
          {(() => {
            const isFocus = focusSessionEnd != null && focusSessionEnd > now;
            const focusMinsLeft = isFocus ? Math.ceil((focusSessionEnd! - now) / 60_000) : 0;
            return (
              <>
                <View style={styles.settingsRow}>
                  <Text style={{ fontSize: 20 }}>🎯</Text>
                  <View style={styles.settingsRowMiddle}>
                    <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Focus Session</Text>
                    {isFocus ? (
                      <Text style={[styles.settingsRowSub, { color: C.green }]}>
                        {focusMinsLeft} min left — no bypasses until{' '}
                        {new Date(focusSessionEnd!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    ) : (
                      <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                        Hard lock with no game bypass
                      </Text>
                    )}
                  </View>
                  {isFocus && (
                    <Pressable
                      onPress={() => {
                        Alert.alert(
                          'End focus session?',
                          'You set this time aside intentionally. Are you sure you want to end it early?',
                          [
                            { text: 'Keep going', style: 'cancel' },
                            { text: 'End session', style: 'destructive', onPress: endFocusSession },
                          ]
                        );
                      }}
                    >
                      <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>End</Text>
                    </Pressable>
                  )}
                </View>
                {!isFocus && (
                  <View style={styles.durationRow}>
                    {([25, 50, 90] as const).map((min) => (
                      <Pressable
                        key={min}
                        style={[styles.durationPill, { backgroundColor: C.background, borderColor: C.border }]}
                        onPress={() => startFocusSession(min)}
                      >
                        <Text style={[styles.durationPillText, { color: C.textPrimary }]}>{min}m</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </>
            );
          })()}

          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── Game duration (Pro only) ── */}
          {/* Controls how long each mini-game lasts. Default 30s, Pro can extend. */}
          {isPro ? (
            <>
              <View style={styles.settingsRow}>
                <Feather name="clock" size={20} color={C.purple} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Game Duration</Text>
                  <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
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
                      { backgroundColor: C.background, borderColor: C.border },
                      gameDuration === d && { backgroundColor: C.purpleDim, borderColor: C.purple + '66' },
                    ]}
                    onPress={() => setGameDuration(d)}
                  >
                    <Text
                      style={[
                        styles.durationPillText,
                        { color: C.textMuted },
                        gameDuration === d && [styles.durationPillTextActive, { color: C.purple }],
                      ]}
                    >
                      {d}s
                    </Text>
                  </Pressable>
                ))}
              </View>

              <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />
            </>
          ) : (
            // Free users see a locked row that routes to paywall
            <>
              <Pressable
                style={styles.settingsRow}
                onPress={() => router.push('/paywall')}
              >
                <Feather name="clock" size={20} color={C.textMuted} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={[styles.settingsRowText, { color: C.textMuted }]}>
                    Game Duration
                  </Text>
                  <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>Pro — 30/60/90 second games</Text>
                </View>
                <Feather name="lock" size={14} color={C.textMuted} />
              </Pressable>
              <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />
            </>
          )}

          {/* ── Streak restores (Pro only) ── */}
          {isPro && (
            <>
              <View style={styles.settingsRow}>
                <Feather name="shield" size={20} color={C.purple} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Streak Protection</Text>
                  <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                    {streakRestoresLeft > 0
                      ? `${streakRestoresLeft} restore available this month`
                      : 'Used this month — resets next month'}
                  </Text>
                </View>
              </View>
              <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />
            </>
          )}

          {/* ── Accountability partner (Pro only) ── */}
          {isPro ? (
            <>
              <Pressable
                style={styles.settingsRow}
                onPress={() => router.push('/partner')}
              >
                <Feather name="users" size={20} color={C.cyan} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Accountability Partner</Text>
                  <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                    Set up a partner to keep you honest
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={C.textMuted} />
              </Pressable>
              <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />
            </>
          ) : (
            <>
              <Pressable
                style={styles.settingsRow}
                onPress={() => router.push('/paywall')}
              >
                <Feather name="users" size={20} color={C.textMuted} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={[styles.settingsRowText, { color: C.textMuted }]}>
                    Accountability Partner
                  </Text>
                  <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>Pro — notify someone when you slip</Text>
                </View>
                <Feather name="lock" size={14} color={C.textMuted} />
              </Pressable>
              <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />
            </>
          )}

          {/* ── Impulse journal ── */}
          <Pressable
            style={styles.settingsRow}
            onPress={() => router.push('/journal')}
          >
            <Feather name="book-open" size={20} color={C.green} />
            <View style={styles.settingsRowMiddle}>
              <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Impulse Journal</Text>
              <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                Review your past intercept entries
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={C.textMuted} />
          </Pressable>

          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── Weekly insights (Pro) ── */}
          {isPro ? (
            <>
              <Pressable
                style={styles.settingsRow}
                onPress={() => router.push('/insights')}
              >
                <Feather name="bar-chart-2" size={20} color={C.purple} />
                <View style={styles.settingsRowMiddle}>
                  <Text style={[styles.settingsRowText, { color: C.textPrimary }]}>Weekly Insights</Text>
                  <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                    Deep stats on your blocking patterns
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color={C.textMuted} />
              </Pressable>
            </>
          ) : null}

          {/* ── Developer Mode toggle — inside settings card so it's always visible ── */}
          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />
          <View style={styles.settingsRow}>
            <Feather name="tool" size={20} color={C.warning} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.settingsRowText, { color: C.warning }]}>
                🛠️ Dev Mode {devModeEnabled ? '— ON (Pro unlocked)' : '— OFF'}
              </Text>
              <Text style={[styles.settingsRowSub, { color: C.textMuted }]}>
                {devModeEnabled
                  ? 'All Pro features active for testing'
                  : 'Simulate Pro subscription for testing'}
              </Text>
            </View>
            <Switch
              value={devModeEnabled}
              onValueChange={toggleDevMode}
              trackColor={{ false: C.border, true: C.warning + '77' }}
              thumbColor={devModeEnabled ? C.warning : C.textMuted}
            />
          </View>
          <View style={[styles.settingsDivider, { backgroundColor: C.border }]} />

          {/* ── Sign out ── */}
          <Pressable style={styles.settingsRow} onPress={handleSignOut}>
            <Feather name="log-out" size={20} color={C.danger} />
            <Text style={[styles.settingsRowText, { color: C.danger }]}>Sign Out</Text>
          </Pressable>
        </View>

        {/* Ad banner — visible to free users at the bottom of their profile */}
        <AdBanner size="banner" style={{ marginTop: SPACING.md }} />

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── StatCell sub-component ────────────────────────────────────────────────────

function StatCell({ label, value, color, C }: { label: string; value: string; color: string; C: typeof COLORS }) {
  return (
    <View style={[styles.statCell, { backgroundColor: C.surface, borderColor: C.cardBorder }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: C.textMuted }]}>{label}</Text>
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
    borderColor: COLORS.indigoBright,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  avatarInitials: {
    fontFamily: FONTS.display,
    fontSize: 30,
    color: COLORS.indigoBright,
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

  // ── Walk-Away Hero ──
  walkAwayHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
  },
  walkAwayLeft: {
    gap: 3,
  },
  walkAwayNumber: {
    fontFamily: FONTS.monoBold,
    fontSize: 42,
    lineHeight: 46,
  },
  walkAwayLabel: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
  },
  walkAwayCaption: {
    fontFamily: FONTS.body,
    fontSize: 12,
    marginTop: 1,
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
    padding: SPACING.md,
    gap: 2,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: FONTS.monoBold,
    fontSize: 24,
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // ── Achievements grid ──
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  achievementCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 4,
    alignItems: 'center',
  },
  achievementEmoji: {
    fontSize: 28,
    lineHeight: 36,
  },
  achievementLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    textAlign: 'center',
  },
  achievementDesc: {
    fontFamily: FONTS.body,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
  },

  // ── Achievement extras ──
  achievementLocked: {
    opacity: 0.45,
  },
  earnedBadge: {
    marginTop: 4,
  },

  // ── Daily intention input ──
  intentionInput: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    fontFamily: FONTS.body,
    fontSize: 14,
    marginTop: 4,
  },

  // ── Block schedule time pickers ──
  scheduleTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  scheduleTimeField: {
    flex: 1,
    gap: 3,
  },
  scheduleTimeLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  scheduleTimeInput: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    fontFamily: FONTS.mono,
    fontSize: 14,
    textAlign: 'center',
  },
  scheduleTimeSep: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    marginTop: 16,
  },

  // ── Wind-down hour picker ──
  windDownHourRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  windDownHourPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  windDownHourText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    letterSpacing: 0.2,
  },



  // ── Section header ──
  sectionHeader: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },

  // ── Pro upgrade banner ──
  proActiveBanner: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  proActiveText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    flex: 1,
  },
  upgradeButton: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  upgradeLeft: {
    flex: 1,
    gap: 2,
  },
  upgradeTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
  },
  upgradeSubtitle: {
    fontFamily: FONTS.body,
    fontSize: 12,
  },

  // ── Settings card ──
  settingsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsDivider: {
    height: 1,
    marginHorizontal: SPACING.md,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  settingsRowMiddle: {
    flex: 1,
    gap: 1,
  },
  settingsRowText: {
    fontFamily: FONTS.body,
    fontSize: 14,
  },
  settingsRowSub: {
    fontFamily: FONTS.body,
    fontSize: 11,
  },

  // ── Duration row (Pro) ──
  durationRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  durationPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  durationPillText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
  },
  durationPillTextActive: {
    fontFamily: FONTS.monoBold ?? FONTS.mono,
    fontSize: 12,
  },

  // ── Day-of-week picker ────────────────────────────────────────────────────
  dayPickerRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: SPACING.sm,
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  dayChipText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
