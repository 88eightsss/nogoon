// Arcade screen — lets users play mini-games freely ("practice mode"),
// outside of any GATE content interception.
//
// Currently shows the Stroop Challenge.
// More games will be added here in subsequent builds.

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { StroopChallenge } from '@/components/games/StroopChallenge';
import { PatternMemory } from '@/components/games/PatternMemory';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { TYPE } from '@/constants/Typography';

export default function ArcadeScreen() {
  // Which game is currently active. null = game selection screen.
  const [activeGame, setActiveGame] = useState<string | null>(null);

  // Called by a game when it finishes — score passed up from the game component
  const handleGameComplete = (score: number) => {
    console.log(`Game finished with score: ${score}`);
    // Return to game selection
    setActiveGame(null);
  };

  // ── If a game is running, render it full-screen ──────────────────────────
  if (activeGame === 'stroop') {
    return <StroopChallenge onComplete={handleGameComplete} />;
  }
  if (activeGame === 'memory') {
    return <PatternMemory onComplete={handleGameComplete} />;
  }

  // ── Game selection screen ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Text style={[TYPE.headingL, { color: COLORS.purple }]}>Arcade</Text>
      <Text style={[TYPE.bodyS, styles.sub]}>
        Train your brain. Pick a game.
      </Text>

      {/* Stroop Challenge card */}
      <Pressable
        style={styles.gameCard}
        onPress={() => setActiveGame('stroop')}
      >
        <Text style={styles.gameEmoji}>🎨</Text>
        <View style={styles.gameInfo}>
          <Text style={styles.gameTitle}>Stroop Challenge</Text>
          <Text style={styles.gameDesc}>
            Name the ink color, not the word. 30 seconds.
          </Text>
        </View>
        <Text style={styles.gameArrow}>›</Text>
      </Pressable>

      {/* Pattern Memory — now live */}
      <Pressable
        style={styles.gameCard}
        onPress={() => setActiveGame('memory')}
      >
        <Text style={styles.gameEmoji}>🧩</Text>
        <View style={styles.gameInfo}>
          <Text style={styles.gameTitle}>Pattern Memory</Text>
          <Text style={styles.gameDesc}>
            Watch the sequence, repeat it back. 30 seconds.
          </Text>
        </View>
        <Text style={[styles.gameArrow, { color: COLORS.cyan }]}>›</Text>
      </Pressable>

      {/* Placeholder cards for remaining games */}
      {['Orb Catcher', 'Breathing Exercise', 'Quick Math'].map(
        (name) => (
          <View key={name} style={[styles.gameCard, styles.gameCardLocked]}>
            <Text style={styles.gameEmoji}>🔒</Text>
            <View style={styles.gameInfo}>
              <Text style={[styles.gameTitle, { color: COLORS.textMuted }]}>
                {name}
              </Text>
              <Text style={styles.gameDesc}>Coming next</Text>
            </View>
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.huge,
    gap: SPACING.sm,
  },
  sub: {
    marginBottom: SPACING.lg,
  },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  gameCardLocked: {
    opacity: 0.45,
  },
  gameEmoji: {
    fontSize: 28,
  },
  gameInfo: {
    flex: 1,
  },
  gameTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  gameDesc: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  gameArrow: {
    fontFamily: FONTS.body,
    fontSize: 24,
    color: COLORS.purple,
  },
});
