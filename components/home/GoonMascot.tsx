// ─── GoonMascot — Tamagotchi companion ────────────────────────────────────────
//
// 3 selectable companions. Each evolves through 5 stages driven by
// lifetime walkAwayCount.
//
// Characters:
//   Buddy  — round friendly blob (green/orange)
//   Nova   — cosmic floating orb (cyan/purple)
//   Rex    — pixel dragon/dino (red/gold)
//
// Stages:
//   0 (0–4)    Dormant    — sleeping
//   1 (5–14)   Awakening  — eyes open
//   2 (15–29)  Standing   — arms out
//   3 (30–59)  Powered    — armor/glow
//   4 (60+)    Legendary  — full power
//
// Pet interactions:
//   Tap           → wave animation + speech bubble
//   Long press    → secret panel (custom speech · stat bars toggle)
//   Feed button   → spend 1 feed token, restore hunger

import { useRef, useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Animated, Pressable, Modal, TextInput,
  Switch, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';
import { usePetStore, getPetMood, getPetSpeech, type CharacterId } from '@/stores/usePetStore';
import { getFeedTokens, spendFeedToken, getMinutesAway, MINS_PER_TOKEN } from '@/services/feedTokens';
import { notifyHungerWarning } from '@/utils/notifications';

// ─── Stage system ─────────────────────────────────────────────────────────────

export type GoonStage = 0 | 1 | 2 | 3 | 4;

export function getGoonStage(walkAwayCount: number): GoonStage {
  if (walkAwayCount >= 60) return 4;
  if (walkAwayCount >= 30) return 3;
  if (walkAwayCount >= 15) return 2;
  if (walkAwayCount >= 5)  return 1;
  return 0;
}

const STAGE_LABELS: Record<GoonStage, string> = {
  0: 'Dormant',
  1: 'Awakening',
  2: 'Standing Guard',
  3: 'Battle-Ready',
  4: 'Legendary',
};

const NEXT_AT: Record<GoonStage, number | null> = {
  0: 5, 1: 15, 2: 30, 3: 60, 4: null,
};

// ─── Character types ──────────────────────────────────────────────────────────
// CharacterId is defined in usePetStore and re-exported from there.

const CHARACTER_NAMES: Record<CharacterId, string> = {
  0: 'Buddy',
  1: 'Nova',
  2: 'Rex',
};

const CHARACTER_TAGLINES: Record<CharacterId, string> = {
  0: 'Friendly · Grows with you',
  1: 'Cosmic · Floats above it all',
  2: 'Bold · Dragon energy',
};

export const STORAGE_KEY = '@nogoon_goon_character';
const CUSTOM_SPEECH_KEY  = '@nogoon_pet_speech';
const SHOW_STATS_KEY     = '@nogoon_show_stats';
const LAST_STAGE_KEY     = '@nogoon_last_stage';
const PET_INTERACTION_COUNT_KEY = '@nogoon_pet_interaction_count';
const PET_SPEECH_EVERY = 8; // your pal only speaks up every N pets/taps, not every single one

/** Per-character name key — each companion has its own nickname slot. */
function petNameKey(charId: CharacterId) {
  return `@nogoon_pet_name_${charId}`;
}

/**
 * Shared "only speak up every Nth pet" gate — same persisted counter and
 * threshold the main mascot uses (registerPetInteraction below), exported
 * so other surfaces that render their own companion tap interaction (e.g.
 * Organizer mode's CompanionWidget/CompanionHeroWidget in HomeOrganizer.tsx)
 * throttle speech the same way instead of showing a new line on every tap.
 * Returns a function that increments the shared count and resolves to
 * `true` only on every PET_SPEECH_EVERY-th call — callers decide what to do
 * with that (e.g. only update their own speech-bubble state when true).
 * The tap/wave animation itself is NOT gated by this — only the talking is.
 */
export function usePetPokeGate() {
  const countRef = useRef(0);
  useEffect(() => {
    AsyncStorage.getItem(PET_INTERACTION_COUNT_KEY).then((v) => {
      countRef.current = v ? Number(v) : 0;
    });
  }, []);
  return useCallback(() => {
    const next = countRef.current + 1;
    countRef.current = next;
    AsyncStorage.setItem(PET_INTERACTION_COUNT_KEY, String(next));
    return next % PET_SPEECH_EVERY === 0;
  }, []);
}

// ─── Pixel grid ───────────────────────────────────────────────────────────────
// 10×12 grid, 8px/cell. Pixel values:
//   0 = transparent   1 = body   2 = eye/dark   3 = accent/glow   4 = eye highlight

const CELL = 8;
type Pixel = 0 | 1 | 2 | 3 | 4;

// ─── Color palettes per character ────────────────────────────────────────────

export const CHAR_COLORS: Record<CharacterId, Record<GoonStage, Record<number, string>>> = {
  // Buddy — slate → blue → green → purple → orange
  0: {
    0: { 1: '#94a3b8', 2: '#334155', 3: '#e2e8f0', 4: '#f8fafc' },
    1: { 1: '#3b82f6', 2: '#1e3a8a', 3: '#93c5fd', 4: '#eff6ff' },
    2: { 1: '#22c55e', 2: '#14532d', 3: '#86efac', 4: '#f0fdf4' },
    3: { 1: '#a855f7', 2: '#4c1d95', 3: '#d8b4fe', 4: '#faf5ff' },
    4: { 1: '#f97316', 2: '#7c2d12', 3: '#fed7aa', 4: '#fff7ed' },
  },
  // Nova — indigo → cyan → teal → violet → gold
  1: {
    0: { 1: '#818cf8', 2: '#3730a3', 3: '#c7d2fe', 4: '#eef2ff' },
    1: { 1: '#22d3ee', 2: '#164e63', 3: '#a5f3fc', 4: '#ecfeff' },
    2: { 1: '#2dd4bf', 2: '#134e4a', 3: '#99f6e4', 4: '#f0fdfa' },
    3: { 1: '#a78bfa', 2: '#4c1d95', 3: '#ddd6fe', 4: '#f5f3ff' },
    4: { 1: '#fbbf24', 2: '#78350f', 3: '#fde68a', 4: '#fffbeb' },
  },
  // Rex — red → orange → gold → deep orange → fire
  2: {
    0: { 1: '#f87171', 2: '#7f1d1d', 3: '#fecaca', 4: '#fef2f2' },
    1: { 1: '#fb923c', 2: '#7c2d12', 3: '#fed7aa', 4: '#fff7ed' },
    2: { 1: '#facc15', 2: '#713f12', 3: '#fef08a', 4: '#fefce8' },
    3: { 1: '#f97316', 2: '#431407', 3: '#fca5a5', 4: '#fff1f2' },
    4: { 1: '#dc2626', 2: '#1c0202', 3: '#f97316', 4: '#fef3c7' },
  },
};

// ─── Sprite grids ─────────────────────────────────────────────────────────────

const GRIDS: Record<CharacterId, Record<GoonStage, Pixel[][]>> = {

  // ── Buddy — round friendly blob ─────────────────────────────────────────────
  0: {
    0: [
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,0],
      [0,1,1,0,0,0,0,1,1,0],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    1: [
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,2,4,1,2,4,1,0],
      [0,1,1,2,1,1,2,1,1,0],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,3,3,1,1,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    2: [
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,2,4,1,2,4,1,0],
      [0,1,1,2,1,1,2,1,1,0],
      [0,1,1,1,3,3,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,0,0,1,1,0,0],
      [0,0,1,1,0,0,1,1,0,0],
      [0,0,1,0,0,0,0,1,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    3: [
      [3,0,0,1,1,1,1,0,0,3],
      [0,3,1,1,1,1,1,1,3,0],
      [0,1,1,2,4,1,2,4,1,0],
      [0,1,1,2,1,1,2,1,1,0],
      [3,1,1,1,3,3,1,1,1,3],
      [0,1,1,1,1,1,1,1,1,0],
      [3,1,1,1,1,1,1,1,1,3],
      [0,3,0,1,1,1,1,0,3,0],
      [0,0,1,1,0,0,1,1,0,0],
      [0,0,1,1,0,0,1,1,0,0],
      [0,0,3,0,0,0,0,3,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    4: [
      [0,3,3,0,3,3,0,3,3,0],
      [0,0,3,1,1,1,1,3,0,0],
      [3,1,1,2,4,1,2,4,1,3],
      [3,1,1,2,3,3,2,1,1,3],
      [3,1,1,3,3,3,3,1,1,3],
      [3,3,1,1,1,1,1,1,3,3],
      [0,3,3,1,1,1,1,3,3,0],
      [0,0,3,3,1,1,3,3,0,0],
      [0,0,1,1,3,3,1,1,0,0],
      [0,0,3,1,0,0,1,3,0,0],
      [0,0,1,3,0,0,3,1,0,0],
      [0,0,3,0,0,0,0,3,0,0],
    ],
  },

  // ── Nova — cosmic floating orb ──────────────────────────────────────────────
  1: {
    0: [
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,1,1,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,3,3,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    1: [
      [0,0,3,0,0,0,0,3,0,0],
      [0,0,0,3,0,0,3,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,2,4,1,1,0,0],
      [0,1,1,1,2,1,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,3,3,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    2: [
      [0,0,3,0,0,0,0,3,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,1,1,1,1,1,1,1,1,0],
      [1,1,1,2,4,1,2,4,1,1],
      [1,1,1,2,1,1,2,1,1,1],
      [0,1,1,1,3,3,1,1,1,0],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,3,1,1,1,1,3,0,0],
      [0,0,0,3,1,1,3,0,0,0],
      [0,0,0,0,3,3,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    3: [
      [3,0,3,0,0,0,0,3,0,3],
      [0,3,0,1,1,1,1,0,3,0],
      [3,1,1,1,1,1,1,1,1,3],
      [1,1,1,2,4,1,2,4,1,1],
      [1,3,1,2,1,1,2,1,3,1],
      [3,1,1,1,3,3,1,1,1,3],
      [0,3,1,1,1,1,1,1,3,0],
      [0,0,3,3,1,1,3,3,0,0],
      [0,0,0,3,3,3,3,0,0,0],
      [0,0,0,0,3,3,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    4: [
      [3,3,3,0,3,3,0,3,3,3],
      [3,0,0,3,1,1,3,0,0,3],
      [3,1,1,1,1,1,1,1,1,3],
      [1,1,3,2,4,1,2,4,3,1],
      [1,3,1,2,3,3,2,1,3,1],
      [3,1,3,3,3,3,3,3,1,3],
      [3,3,1,1,1,1,1,1,3,3],
      [0,3,3,3,1,1,3,3,3,0],
      [0,0,3,3,3,3,3,3,0,0],
      [0,0,0,3,3,3,3,0,0,0],
      [0,0,0,0,3,3,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
  },

  // ── Rex — pixel dragon/dino ──────────────────────────────────────────────────
  2: {
    0: [
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,1,3,1,1,1,1,0],
      [0,1,1,1,1,3,1,1,1,0],
      [0,1,1,1,1,1,3,1,1,0],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    1: [
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,3,1,1,3,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,2,4,1,2,4,0,0],
      [0,0,1,2,1,1,2,1,0,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,0,0,1,3,3,1,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,0,0,1,1,0,0],
      [0,0,1,0,0,0,0,1,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    2: [
      [0,0,3,1,0,0,1,3,0,0],
      [0,0,1,1,1,1,1,1,0,0],
      [0,1,1,2,4,1,2,4,1,0],
      [0,1,1,2,1,1,2,1,1,0],
      [0,1,3,1,3,3,1,3,1,0],
      [0,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1],
      [3,0,1,1,1,1,1,1,0,3],
      [0,0,1,1,0,0,1,1,0,0],
      [0,0,1,0,0,0,0,1,0,0],
      [0,0,0,3,0,0,3,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    3: [
      [0,3,3,1,3,3,1,3,3,0],
      [3,3,1,1,1,1,1,1,3,3],
      [3,1,1,2,4,1,2,4,1,3],
      [3,1,3,2,1,1,2,3,1,3],
      [3,1,1,3,3,3,3,1,1,3],
      [0,3,1,1,1,1,1,1,3,0],
      [3,1,3,1,1,1,1,3,1,3],
      [3,3,0,3,1,1,3,0,3,3],
      [0,3,1,1,0,0,1,1,3,0],
      [0,0,3,1,0,0,1,3,0,0],
      [0,0,1,3,0,0,3,1,0,0],
      [0,0,3,0,0,0,0,3,0,0],
    ],
    4: [
      [3,3,3,1,3,3,1,3,3,3],
      [3,0,3,1,1,1,1,3,0,3],
      [3,1,1,2,4,3,2,4,1,3],
      [3,1,3,2,3,3,2,3,1,3],
      [3,3,1,3,3,3,3,1,3,3],
      [3,1,3,1,1,1,1,3,1,3],
      [3,3,1,3,1,1,3,1,3,3],
      [3,3,3,3,1,1,3,3,3,3],
      [0,3,1,1,3,3,1,1,3,0],
      [0,0,3,1,3,3,1,3,0,0],
      [0,0,1,3,0,0,3,1,0,0],
      [0,0,3,0,0,0,0,3,0,0],
    ],
  },
};

// ─── Sprite renderer ──────────────────────────────────────────────────────────

export function GoonSprite({
  char, stage, size = 1,
}: { char: CharacterId; stage: GoonStage; size?: number }) {
  const grid   = GRIDS[char][stage];
  const px     = CELL * size;
  const colors = CHAR_COLORS[char][stage];
  return (
    <Svg width={10 * px} height={12 * px}>
      {grid.map((row, r) =>
        row.map((val, c) => {
          if (val === 0) return null;
          return (
            <Rect
              key={`${r}-${c}`}
              x={c * px}
              y={r * px}
              width={px - 1}
              height={px - 1}
              fill={colors[val]}
              rx={val === 4 ? 0 : 1}
            />
          );
        })
      )}
    </Svg>
  );
}

// ─── Evolution ceremony modal ─────────────────────────────────────────────────

function EvolutionModal({
  char, stage, petName, onDone,
}: { char: CharacterId; stage: GoonStage; petName: string; onDone: () => void }) {
  const glow = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.5, duration: 400, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const accentColor = CHAR_COLORS[char][stage][1];

  return (
    <Modal visible transparent animationType="fade">
      <View style={evoStyles.backdrop}>
        <Animated.View style={[evoStyles.sheet, { transform: [{ scale }] }]}>
          <Text style={evoStyles.eyebrow}>Evolution</Text>
          <Animated.View style={{ opacity: glow }}>
            <GoonSprite char={char} stage={stage} size={1.5} />
          </Animated.View>
          <Text style={[evoStyles.stageName, { color: accentColor }]}>
            {STAGE_LABELS[stage]}
          </Text>
          <Text style={evoStyles.name}>{petName} evolved!</Text>
          <Text style={evoStyles.sub}>
            {CHARACTER_TAGLINES[char]}
          </Text>
          <Pressable
            style={[evoStyles.btn, { backgroundColor: accentColor }]}
            onPress={onDone}
          >
            <Text style={evoStyles.btnText}>Keep going</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const evoStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.90)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    width: '100%',
  },
  eyebrow: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  stageName: {
    fontFamily: FONTS.display,
    fontSize: 26,
    letterSpacing: -0.5,
    marginTop: SPACING.xs,
  },
  name: {
    fontFamily: FONTS.bodyBold,
    fontSize: 16,
    color: COLORS.textPrimary,
    marginTop: -SPACING.xs,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  btn: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  btnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 15,
    color: '#fff',
  },
});

// ─── Character picker ─────────────────────────────────────────────────────────

function CharacterPicker({ onPick }: { onPick: (id: CharacterId) => void }) {
  return (
    <Modal visible transparent animationType="fade">
      <View style={pickerStyles.backdrop}>
        <View style={pickerStyles.sheet}>
          <Text style={pickerStyles.title}>Choose Your Companion</Text>
          <Text style={pickerStyles.sub}>Your Goon grows as you walk away from distractions.</Text>

          <View style={pickerStyles.row}>
            {([0, 1, 2] as CharacterId[]).map((id) => (
              <Pressable
                key={id}
                style={pickerStyles.card}
                onPress={() => onPick(id)}
              >
                <GoonSprite char={id} stage={2} size={0.85} />
                <Text style={pickerStyles.charName}>{CHARACTER_NAMES[id]}</Text>
                <Text style={pickerStyles.charTag}>{CHARACTER_TAGLINES[id]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.lg,
    width: '100%',
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 20,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: -SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    paddingVertical: SPACING.lg,
  },
  charName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  charTag: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 14,
  },
});

// ─── Stat bar ─────────────────────────────────────────────────────────────────

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={statStyles.row}>
      <Text style={statStyles.label}>{label}</Text>
      <View style={statStyles.track}>
        <View style={[statStyles.fill, { width: `${value}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={statStyles.pct}>{Math.round(value)}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    width: 64,
  },
  track: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  pct: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    width: 24,
    textAlign: 'right',
  },
});

// ─── Secret panel modal ───────────────────────────────────────────────────────

interface SecretPanelProps {
  petName:      string;
  stats:        { hunger: number; happiness: number; energy: number };
  customSpeech: string;
  showStats:    boolean;
  onChangeName:   (v: string) => void;
  onChangeSpeech: (v: string) => void;
  onToggleStats:  (v: boolean) => void;
  onClose:      () => void;
  accentColor:  string;
}

function SecretPanel({
  petName, stats, customSpeech, showStats,
  onChangeName, onChangeSpeech, onToggleStats, onClose, accentColor,
}: SecretPanelProps) {
  const [nameDraft,   setNameDraft]   = useState(petName);
  const [speechDraft, setSpeechDraft] = useState(customSpeech);

  return (
    <Modal visible transparent animationType="slide">
      <KeyboardAvoidingView
        style={panelStyles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={panelStyles.sheet}>
          <Text style={panelStyles.title}>Customize {petName}</Text>

          <View style={panelStyles.section}>
            <Text style={panelStyles.sectionLabel}>Nickname</Text>
            <TextInput
              style={panelStyles.input}
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Give your companion a name"
              placeholderTextColor={COLORS.textMuted}
              maxLength={20}
            />
          </View>

          <View style={panelStyles.section}>
            <Text style={panelStyles.sectionLabel}>Custom speech bubble</Text>
            <TextInput
              style={panelStyles.input}
              value={speechDraft}
              onChangeText={setSpeechDraft}
              placeholder="Leave blank for auto mood messages"
              placeholderTextColor={COLORS.textMuted}
              maxLength={80}
            />
          </View>

          <View style={panelStyles.section}>
            <View style={panelStyles.toggleRow}>
              <Text style={panelStyles.sectionLabel}>Show stat bars</Text>
              <Switch
                value={showStats}
                onValueChange={onToggleStats}
                trackColor={{ false: COLORS.border, true: accentColor }}
                thumbColor={COLORS.textPrimary}
              />
            </View>
            {showStats && (
              <View style={{ gap: SPACING.xs, marginTop: SPACING.sm }}>
                <StatBar label="Hunger"    value={stats.hunger}    color={accentColor} />
                <StatBar label="Happiness" value={stats.happiness} color={COLORS.cyan} />
                <StatBar label="Energy"    value={stats.energy}    color="#94a3b8" />
              </View>
            )}
          </View>

          <View style={panelStyles.buttons}>
            <Pressable style={[panelStyles.btn, panelStyles.btnPrimary, { backgroundColor: accentColor }]}
              onPress={() => {
                const trimmed = nameDraft.trim();
                if (trimmed) onChangeName(trimmed);
                onChangeSpeech(speechDraft);
                onClose();
              }}>
              <Text style={panelStyles.btnTextPrimary}>Save</Text>
            </Pressable>
            <Pressable style={[panelStyles.btn, panelStyles.btnSecondary]} onPress={onClose}>
              <Text style={panelStyles.btnTextSecondary}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const panelStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    gap: SPACING.lg,
    paddingBottom: SPACING.xl + 16,
  },
  title: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  section: {
    gap: SPACING.xs,
  },
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buttons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  btnPrimary: {},
  btnSecondary: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnTextPrimary: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: '#000',
  },
  btnTextSecondary: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});

// ─── Accumulation hint ────────────────────────────────────────────────────────
// Shows how long the user has been away and when they'll earn the next token.
// Resets every time they open the app — that's the whole game.

function AccumulationHint({
  minsAway, tokens, accentColor,
}: { minsAway: number; tokens: number; accentColor: string }) {
  const minsToNext = MINS_PER_TOKEN - (minsAway % MINS_PER_TOKEN);
  const isEarning  = minsAway >= 1;
  const isCapped   = tokens >= 8;

  if (isCapped) {
    return (
      <Text style={hintStyles.text}>
        Meals capped at 8. Go feed {'—'} come back later.
      </Text>
    );
  }

  if (!isEarning) {
    return (
      <Text style={hintStyles.text}>
        Stay away to earn meals. Clock resets each visit.
      </Text>
    );
  }

  const minsDisplay = Math.floor(minsAway);
  const nextDisplay = Math.ceil(minsToNext);

  return (
    <Text style={hintStyles.text}>
      <Text style={{ color: accentColor }}>{minsDisplay} min</Text> away this session
      {' · '}next meal in <Text style={{ color: accentColor }}>{nextDisplay} min</Text>
    </Text>
  );
}

const hintStyles = StyleSheet.create({
  text: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: -SPACING.xs,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  walkAwayCount: number;
  onPress?: () => void;
}

export function GoonMascot({ walkAwayCount, onPress }: Props) {
  const [character,      setCharacter]      = useState<CharacterId | null>(null);
  const [petName,        setPetName]        = useState('');
  const [showPicker,     setShowPicker]     = useState(false);
  const [showPanel,      setShowPanel]      = useState(false);
  const [showEvolution,  setShowEvolution]  = useState(false);
  const [evolvedStage,   setEvolvedStage]   = useState<GoonStage>(0);
  const [loaded,         setLoaded]         = useState(false);
  const [feedTokens,     setFeedTokens]     = useState(0);
  const [minsAway,       setMinsAway]       = useState(0);
  const [customSpeech,   setCustomSpeech]   = useState('');
  const [showStats,      setShowStats]      = useState(false);
  const [speechText,     setSpeechText]     = useState<string | null>(null);
  const speechTimer                         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feedFeedback,   setFeedFeedback]   = useState<string | null>(null);
  const petInteractionCountRef              = useRef(0);

  const petStore = usePetStore();

  // ── Load persisted character + prefs ──────────────────────────────────────
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(CUSTOM_SPEECH_KEY),
      AsyncStorage.getItem(SHOW_STATS_KEY),
      AsyncStorage.getItem(PET_INTERACTION_COUNT_KEY),
    ]).then(async ([charVal, speechVal, statsVal, petCountVal]) => {
      petInteractionCountRef.current = petCountVal ? Number(petCountVal) : 0;
      if (charVal !== null) {
        const charId = Number(charVal) as CharacterId;
        setCharacter(charId);
        const nameVal = await AsyncStorage.getItem(petNameKey(charId));
        setPetName(nameVal || CHARACTER_NAMES[charId]);
      } else {
        setShowPicker(true);
      }
      if (speechVal) setCustomSpeech(speechVal);
      if (statsVal === 'true') setShowStats(true);
      setLoaded(true);
    });
  }, []);

  // ── Sync pet decay on mount (all 3 companions) ───────────────────────────
  useEffect(() => {
    petStore.syncDecay(0);
    petStore.syncDecay(1);
    petStore.syncDecay(2);
  }, []);

  // ── Watch hunger for warning ──────────────────────────────────────────────
  const hungerWarnedRef = useRef(false);
  const charHunger = character !== null ? petStore.stats[character].hunger : 100;
  useEffect(() => {
    if (charHunger < 20 && !hungerWarnedRef.current && character !== null) {
      hungerWarnedRef.current = true;
      notifyHungerWarning(petName || CHARACTER_NAMES[character]).catch(() => {});
    }
    if (charHunger >= 30) {
      hungerWarnedRef.current = false;
    }
  }, [charHunger, character]);

  // ── Poll feed tokens + accumulation timer (every 30s) ────────────────────
  useEffect(() => {
    const refresh = async () => {
      const [tokens, mins] = await Promise.all([getFeedTokens(), getMinutesAway()]);
      setFeedTokens(tokens);
      setMinsAway(mins);
    };
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, []);

  // ── Evolution check — fires whenever stage or loaded changes ─────────────
  useEffect(() => {
    if (!loaded || character === null) return;
    const stage = getGoonStage(walkAwayCount);
    AsyncStorage.getItem(LAST_STAGE_KEY).then((raw) => {
      const lastStage = raw !== null ? (Number(raw) as GoonStage) : null;
      if (lastStage === null) {
        // First time — just save current stage, no ceremony
        AsyncStorage.setItem(LAST_STAGE_KEY, String(stage));
      } else if (stage > lastStage) {
        // Evolved — save new stage and show ceremony
        AsyncStorage.setItem(LAST_STAGE_KEY, String(stage));
        setEvolvedStage(stage);
        setShowEvolution(true);
      }
    });
  }, [loaded, character, walkAwayCount]);

  const pickCharacter = useCallback((id: CharacterId) => {
    setCharacter(id);
    setShowPicker(false);
    AsyncStorage.setItem(STORAGE_KEY, String(id));
    // Load this companion's saved name (each companion has its own slot)
    AsyncStorage.getItem(petNameKey(id)).then((saved) => {
      const name = saved || CHARACTER_NAMES[id];
      setPetName(name);
      if (!saved) AsyncStorage.setItem(petNameKey(id), name);
    });
  }, []);

  const handleSaveName = useCallback((val: string) => {
    setPetName(val);
    if (character !== null) {
      AsyncStorage.setItem(petNameKey(character), val);
    }
  }, [character]);

  const handleSaveSpeech = useCallback((val: string) => {
    setCustomSpeech(val);
    AsyncStorage.setItem(CUSTOM_SPEECH_KEY, val);
  }, []);

  const handleToggleStats = useCallback((val: boolean) => {
    setShowStats(val);
    AsyncStorage.setItem(SHOW_STATS_KEY, String(val));
  }, []);

  // ── Speech bubble ─────────────────────────────────────────────────────────
  const showSpeech = useCallback((text: string) => {
    if (speechTimer.current) clearTimeout(speechTimer.current);
    setSpeechText(text);
    speechTimer.current = setTimeout(() => setSpeechText(null), 3000);
  }, []);

  // ── Pet/tap interaction — your pal only speaks up every Nth one, not every
  //    single tap, so the speech bubble stays a treat instead of noise. The
  //    wave animation still plays every time; only the talking is throttled.
  const registerPetInteraction = useCallback((text: string) => {
    const next = petInteractionCountRef.current + 1;
    petInteractionCountRef.current = next;
    AsyncStorage.setItem(PET_INTERACTION_COUNT_KEY, String(next));
    if (next % PET_SPEECH_EVERY === 0) {
      showSpeech(text);
    }
  }, [showSpeech]);

  // ── Feed action ───────────────────────────────────────────────────────────
  const handleFeed = useCallback(async () => {
    const spent = await spendFeedToken();
    if (!spent) {
      showSpeech('No meals yet. Stay off your phone to earn some!');
      return;
    }
    const fed = character !== null ? petStore.feedPet(character) : false;
    if (!fed) {
      // Refund token — pet was already full
      const current = await getFeedTokens();
      await AsyncStorage.setItem('@nogoon_feed_tokens', String(Math.min(current + 1, 8)));
      showSpeech("I'm already full!");
    } else {
      const name = petName || (character !== null ? CHARACTER_NAMES[character] : 'your companion');
      showSpeech(`${name} loved that meal!`);
      setFeedFeedback('+1');
      setTimeout(() => setFeedFeedback(null), 1200);
    }
    getFeedTokens().then(setFeedTokens);
  }, [petStore, character, showSpeech]);

  // ── Float animation ───────────────────────────────────────────────────────
  const floatAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -6, duration: 1400, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0,  duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim]);

  // ── Wave animation (fires on tap + every 4 min) ───────────────────────────
  const waveAnim = useRef(new Animated.Value(0)).current;

  const triggerWave = useCallback(() => {
    waveAnim.setValue(0);
    Animated.sequence([
      Animated.timing(waveAnim, { toValue:  12, duration: 120, useNativeDriver: true }),
      Animated.timing(waveAnim, { toValue: -12, duration: 120, useNativeDriver: true }),
      Animated.timing(waveAnim, { toValue:  10, duration: 100, useNativeDriver: true }),
      Animated.timing(waveAnim, { toValue:  -8, duration: 100, useNativeDriver: true }),
      Animated.timing(waveAnim, { toValue:   5, duration: 80,  useNativeDriver: true }),
      Animated.timing(waveAnim, { toValue:   0, duration: 80,  useNativeDriver: true }),
    ]).start();
  }, [waveAnim]);

  // Dance every 4 minutes
  useEffect(() => {
    const id = setInterval(triggerWave, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, [triggerWave]);

  if (!loaded) return null;

  const stage       = getGoonStage(walkAwayCount);
  const nextAt      = NEXT_AT[stage];
  const accentColor = character !== null ? CHAR_COLORS[character][stage][3] : COLORS.indigoBright;
  const charStats   = character !== null ? petStore.stats[character] : { hunger: 70, happiness: 80, energy: 100 };
  const mood        = getPetMood(charStats);
  const autoSpeech  = character !== null
    ? getPetSpeech(mood, petName || CHARACTER_NAMES[character])
    : '';

  return (
    <>
      {showPicker && <CharacterPicker onPick={pickCharacter} />}

      {showEvolution && character !== null && (
        <EvolutionModal
          char={character}
          stage={evolvedStage}
          petName={petName}
          onDone={() => setShowEvolution(false)}
        />
      )}

      {showPanel && character !== null && (
        <SecretPanel
          petName={petName}
          stats={charStats}
          customSpeech={customSpeech}
          showStats={showStats}
          onChangeName={handleSaveName}
          onChangeSpeech={handleSaveSpeech}
          onToggleStats={handleToggleStats}
          onClose={() => setShowPanel(false)}
          accentColor={accentColor}
        />
      )}

      <Pressable
        onPress={() => {
          if (character !== null) {
            triggerWave();
            registerPetInteraction(customSpeech || autoSpeech);
            onPress?.();
          }
        }}
        onLongPress={() => {
          if (character !== null) setShowPanel(true);
        }}
        delayLongPress={600}
        style={styles.wrap}
      >
        {character !== null && (
          <>
            {/* Speech bubble */}
            {speechText !== null && (
              <View style={styles.bubble}>
                <Text style={styles.bubbleText}>{speechText}</Text>
                <View style={styles.bubbleTail} />
              </View>
            )}

            {/* Sprite with float + wave */}
            <Animated.View style={{
              transform: [
                { translateY: floatAnim },
                { rotate: waveAnim.interpolate({ inputRange: [-15, 15], outputRange: ['-15deg', '15deg'] }) },
              ],
            }}>
              <GoonSprite char={character} stage={stage} size={1} />
            </Animated.View>

            {/* Info row */}
            <View style={styles.info}>
              <Text style={styles.charName}>{petName}</Text>
              <Text style={styles.stageName}>{STAGE_LABELS[stage]}</Text>
              {nextAt !== null ? (
                <Text style={styles.sub}>
                  {nextAt - walkAwayCount} walk-aways to evolve
                </Text>
              ) : (
                <Text style={[styles.sub, { color: accentColor }]}>
                  Max power
                </Text>
              )}
            </View>

            {/* Character switcher */}
            <View style={styles.switcherRow}>
              {([0, 1, 2] as CharacterId[]).map((id) => {
                const active = id === character;
                const btnAccent = CHAR_COLORS[id][stage][1];
                return (
                  <Pressable
                    key={id}
                    onPress={() => pickCharacter(id)}
                    style={[
                      styles.switcherBtn,
                      active && { borderColor: btnAccent, backgroundColor: btnAccent + '18' },
                    ]}
                  >
                    <Text style={[styles.switcherText, active && { color: btnAccent }]}>
                      {CHARACTER_NAMES[id]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Stat bars (when toggled on) */}
            {showStats && (
              <View style={styles.statsWrap}>
                <StatBar label="Hunger"    value={charStats.hunger}    color={accentColor} />
                <StatBar label="Happiness" value={charStats.happiness} color={COLORS.cyan} />
                <StatBar label="Energy"    value={charStats.energy}    color="#94a3b8" />
              </View>
            )}

            {/* Feed row */}
            <View style={styles.feedRow}>
              <View style={styles.tokenBadge}>
                <Text style={styles.tokenCount}>{feedTokens}</Text>
                <Text style={styles.tokenLabel}>meals</Text>
              </View>

              <Pressable
                style={[styles.feedBtn, { borderColor: accentColor }]}
                onPress={handleFeed}
              >
                <Text style={[styles.feedBtnText, { color: accentColor }]}>Feed</Text>
                {feedFeedback && (
                  <Text style={[styles.feedFeedback, { color: accentColor }]}>{feedFeedback}</Text>
                )}
              </Pressable>

              <Pressable
                style={styles.petBtn}
                onPress={() => {
                  if (character !== null) petStore.petPet(character);
                  triggerWave();
                  registerPetInteraction('Thanks for the love!');
                }}
              >
                <Text style={styles.petBtnText}>Pet</Text>
              </Pressable>
            </View>

            {/* Accumulation hint */}
            <AccumulationHint
              minsAway={minsAway}
              tokens={feedTokens}
              accentColor={accentColor}
            />
          </>
        )}
      </Pressable>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  switcherRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  switcherBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switcherText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  bubble: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    maxWidth: 220,
    alignItems: 'center',
    position: 'relative',
    marginBottom: 4,
  },
  bubbleText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -7,
    width: 10,
    height: 10,
    backgroundColor: COLORS.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.cardBorder,
    transform: [{ rotate: '45deg' }],
  },
  info: {
    alignItems: 'center',
    gap: 2,
  },
  charName: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
    color: COLORS.textPrimary,
    letterSpacing: 0.5,
  },
  stageName: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  sub: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  statsWrap: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  tokenBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    minWidth: 52,
  },
  tokenCount: {
    fontFamily: FONTS.bodyBold,
    fontSize: 18,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  tokenLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  feedBtn: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    position: 'relative',
  },
  feedBtnText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 14,
  },
  feedFeedback: {
    position: 'absolute',
    top: -14,
    right: 8,
    fontFamily: FONTS.bodyBold,
    fontSize: 12,
  },
  petBtn: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  petBtnText: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
});
