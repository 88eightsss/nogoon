// ─── Animal Facts — Pro Secret Game ───────────────────────────────────────────
//
// A calm, relaxing trivia game designed as a low-intensity pattern interrupt.
// Unlike the fast-paced games, this one is intentionally gentle — the user reads
// a fun animal fact, then answers one trivia question. No timer, no pressure.
//
// WHY IT WORKS AS A PATTERN INTERRUPT:
// The curiosity hook ("did you know?") engages a different part of the brain
// than doom-scrolling. It's absorbing without being stimulating. Users leave
// feeling calm and slightly smarter, not jangled.
//
// SCORING:
//   Correct answer: 120 pts (100 base + 20 bonus)
//   Wrong answer:   60 pts  (still counts — the user still broke the pattern)
//
// PHASES: 'ready' → 'question' → 'answered' → (onComplete called)

import { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Animated,
  ScrollView,
} from 'react-native';
import { COLORS, FONTS } from '@/constants/Colors';
import { SPACING, RADIUS } from '@/constants/Spacing';

// ─── Animal data types ──────────────────────────────────────────────────────

interface AnimalEntry {
  emoji: string;           // Large display emoji
  name: string;            // Animal common name
  fact: string;            // 2-sentence interesting fact shown on the ready screen
  question: string;        // The trivia question
  answers: string[];       // Four answer options — always 4 items
  correctIndex: number;    // Which index (0–3) is the correct answer
}

// ─── Curated animal list ────────────────────────────────────────────────────
// 10 animals with memorable facts and clear trivia questions.
// Answers are intentionally displayed in a 2×2 grid, so order matters for
// visual balance — keep the correct answer at a variety of positions.

const ANIMALS: AnimalEntry[] = [
  {
    emoji: '🦦',
    name: 'Sea Otter',
    fact:
      "Sea otters hold hands while sleeping so they don't drift apart. " +
      "This is called a 'raft' and groups can hold up to 100 otters.",
    question: 'What is a group of floating sea otters called?',
    answers: ['A raft', 'A pod', 'A colony', 'A drift'],
    correctIndex: 0,
  },
  {
    emoji: '🐙',
    name: 'Octopus',
    fact:
      'Octopuses have three hearts and blue blood. ' +
      'Two hearts pump blood to the gills, while the third pumps it to the rest of the body.',
    question: 'How many hearts does an octopus have?',
    answers: ['Two', 'Three', 'Four', 'One'],
    correctIndex: 1,
  },
  {
    emoji: '🦒',
    name: 'Giraffe',
    fact:
      'Giraffes only sleep about 30 minutes per day, making them one of the least ' +
      'sleep-needing mammals on Earth. They often sleep standing up.',
    question: 'How long does a giraffe sleep each day?',
    answers: ['2 hours', '4 hours', '30 minutes', '8 hours'],
    correctIndex: 2,
  },
  {
    emoji: '🐘',
    name: 'Elephant',
    fact:
      "Elephants are the only animals that can't jump. They also use their feet to " +
      'hear — they detect vibrations in the ground through sensitive cells in their soles.',
    question: 'What do elephants use their feet to do, besides walking?',
    answers: ['Smell', 'See', 'Taste', 'Hear'],
    correctIndex: 3,
  },
  {
    emoji: '🦈',
    name: 'Shark',
    fact:
      "Sharks are older than trees. They've existed for roughly 450 million years, " +
      'while the oldest trees only appeared about 350 million years ago.',
    question: 'Which has existed longer on Earth?',
    answers: ['Sharks', 'Trees', 'Both the same', 'Neither — dinosaurs were first'],
    correctIndex: 0,
  },
  {
    emoji: '🐧',
    name: 'Emperor Penguin',
    fact:
      'Male Emperor penguins fast for up to 4 months while incubating their egg on ' +
      'their feet in Antarctic winter, losing nearly half their body weight.',
    question: 'Where do Emperor penguins keep their egg warm?',
    answers: ['In a nest', 'On their feet', 'Underground', 'In water'],
    correctIndex: 1,
  },
  {
    emoji: '🦜',
    name: 'African Grey Parrot',
    fact:
      "African Grey parrots don't just mimic — they understand concepts like zero, " +
      'bigger/smaller, and can identify colours and shapes with the intelligence of a 5-year-old.',
    question: 'What is the estimated cognitive level of an African Grey parrot?',
    answers: ['A 2-year-old', 'A 10-year-old', 'A 5-year-old', 'A dog'],
    correctIndex: 2,
  },
  {
    emoji: '🐋',
    name: 'Blue Whale',
    fact:
      "The blue whale's heart is roughly the size of a small car and beats just " +
      '2 times per minute when diving. A human could crawl through its aorta.',
    question: "How often does a blue whale's heart beat while diving?",
    answers: ['10 times per minute', 'Once per hour', '30 times per minute', '2 times per minute'],
    correctIndex: 3,
  },
  {
    emoji: '🦔',
    name: 'Hedgehog',
    fact:
      'Hedgehogs are immune to many snake venoms and will sometimes chew toxic plants ' +
      'and smear the foam on their spines as a self-defence mechanism.',
    question: 'What do hedgehogs sometimes smear on their spines for defence?',
    answers: ['Chewed plant foam', 'Mud', 'Their own saliva', 'Tree sap'],
    correctIndex: 0,
  },
  {
    emoji: '🐢',
    name: 'Tortoise',
    fact:
      'Tortoises can live over 200 years. Jonathan, a Seychelles giant tortoise born ' +
      'around 1832, is the oldest known living land animal on Earth.',
    question: "What is the name of the world's oldest known living land tortoise?",
    answers: ['Darwin', 'Jonathan', 'Charles', 'George'],
    correctIndex: 1,
  },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
  onComplete: (score: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AnimalFacts({ onComplete }: Props) {
  // Pick one random animal when the component first mounts — stays fixed for the session
  const [animal] = useState<AnimalEntry>(
    () => ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  );

  // 'ready'    — shows the animal emoji, name, and fact
  // 'question' — shows the trivia question with 4 answer buttons
  // 'answered' — shows the result feedback before calling onComplete
  const [phase, setPhase] = useState<'ready' | 'question' | 'answered'>('ready');

  // Which button index the user tapped (-1 means none yet)
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // Animated value for the feedback flash on each answer button
  // We keep one per button so they can animate independently
  const flashAnims = useRef(
    animal.answers.map(() => new Animated.Value(0))
  ).current;

  // ── Handle the user tapping an answer ──────────────────────────────────────

  const handleAnswer = (index: number) => {
    if (phase === 'answered') return; // Prevent double-tap

    setSelectedIndex(index);
    setPhase('answered');

    const isCorrect = index === animal.correctIndex;
    // Wrong answer still earns 80 pts — breaking the scroll pattern counts
    // even if you didn't know the trivia. Learning is the real reward.
    const score = isCorrect ? 120 : 80;

    // Flash the chosen button — green for correct, red for wrong
    Animated.timing(flashAnims[index], {
      toValue: 1,
      duration: 200,
      useNativeDriver: false, // We're animating backgroundColor, which needs JS driver
    }).start();

    // If wrong, also flash the correct button green so the user learns the answer
    if (!isCorrect) {
      Animated.timing(flashAnims[animal.correctIndex], {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }

    // After a short pause, hand control back to the parent
    setTimeout(() => onComplete(score), 1000);
  };

  // ── Determine button background based on game state ────────────────────────
  // Before answering: all buttons use the default surface color
  // After answering:
  //   - The correct button always turns green
  //   - If the user was wrong, their chosen button turns red
  //   - All other buttons stay default

  const getButtonBackground = (index: number): Animated.AnimatedInterpolation<string> => {
    if (phase !== 'answered') {
      // Not yet answered — return a static value wrapped in Animated interpolation
      // We still return an Animated.Value so the type is consistent
      return flashAnims[index].interpolate({
        inputRange: [0, 1],
        outputRange: [COLORS.surface, COLORS.surface],
      });
    }

    const isCorrect = index === animal.correctIndex;
    const isChosen = index === selectedIndex;
    const wasWrong = selectedIndex !== animal.correctIndex;

    if (isCorrect) {
      // Always highlight the correct answer green
      return flashAnims[index].interpolate({
        inputRange: [0, 1],
        outputRange: [COLORS.surface, COLORS.green],
      });
    }

    if (isChosen && wasWrong) {
      // Highlight the wrong choice red
      return flashAnims[index].interpolate({
        inputRange: [0, 1],
        outputRange: [COLORS.surface, COLORS.danger],
      });
    }

    // All other buttons stay as-is
    return flashAnims[index].interpolate({
      inputRange: [0, 1],
      outputRange: [COLORS.surface, COLORS.surface],
    });
  };

  // ── Determine button text color ─────────────────────────────────────────────
  // Dark text on bright backgrounds (green/red), light text otherwise

  const getButtonTextColor = (index: number): string => {
    if (phase !== 'answered') return COLORS.textPrimary;
    const isCorrect = index === animal.correctIndex;
    const isChosen = index === selectedIndex;
    const wasWrong = selectedIndex !== animal.correctIndex;

    if (isCorrect || (isChosen && wasWrong)) {
      return COLORS.background; // Dark text on bright background
    }
    return COLORS.textMuted;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: READY — show the animal and let the user read the fact before
  //                the question appears. This deliberate pacing is intentional
  //                — it forces a moment of calm engagement.
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === 'ready') {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.readyContainer} bounces={false}>

          {/* Big animal emoji — eye-catching and delightful */}
          <Text style={styles.animalEmoji}>{animal.emoji}</Text>

          {/* Animal name */}
          <Text style={styles.animalName}>{animal.name}</Text>

          {/* The interesting fact the user reads before answering */}
          <View style={styles.factCard}>
            <Text style={styles.factLabel}>Did you know?</Text>
            <Text style={styles.factText}>{animal.fact}</Text>
          </View>

          {/* CTA — only shown after they've had a moment to read */}
          <Pressable
            style={styles.primaryButton}
            onPress={() => setPhase('question')}
          >
            <Text style={styles.primaryButtonText}>I Read It →</Text>
          </Pressable>

          <Text style={styles.hintText}>Read the fact — a question is coming</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE: QUESTION / ANSWERED — show the question and 2×2 button grid
  // The 'answered' phase uses the same layout but with colored buttons
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.questionContainer} bounces={false}>

        {/* Small animal reminder so context isn't lost */}
        <Text style={styles.animalEmojiSmall}>{animal.emoji}</Text>

        {/* The trivia question */}
        <Text style={styles.questionText}>{animal.question}</Text>

        {/* 2×2 grid of answer buttons */}
        <View style={styles.answersGrid}>
          {animal.answers.map((answer, index) => (
            <Animated.View
              key={index}
              style={[
                styles.answerButtonWrapper,
                { backgroundColor: getButtonBackground(index) },
              ]}
            >
              <Pressable
                style={styles.answerButtonInner}
                onPress={() => handleAnswer(index)}
                disabled={phase === 'answered'} // Disable after first tap
              >
                <Text
                  style={[
                    styles.answerButtonText,
                    { color: getButtonTextColor(index) },
                  ]}
                >
                  {answer}
                </Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        {/* After answering, show a brief result message */}
        {phase === 'answered' && (
          <Text style={styles.resultText}>
            {selectedIndex === animal.correctIndex
              ? '✅  Correct! +120 pts'
              : `❌  The answer was "${animal.answers[animal.correctIndex]}" — +80 pts`}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Ready phase layout ────────────────────────────────────────────────────
  readyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxxl,
    gap: SPACING.xl,
  },

  animalEmoji: {
    fontSize: 96,  // Very large — makes the animal feel present and playful
    lineHeight: 108,
  },

  animalName: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  factCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: SPACING.xl,
    width: '100%',
    gap: SPACING.sm,
  },

  factLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.purple,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },

  factText: {
    fontFamily: FONTS.body,
    fontSize: 16,
    color: COLORS.textPrimary,
    lineHeight: 24,
  },

  primaryButton: {
    backgroundColor: COLORS.green,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
    width: '100%',
    alignItems: 'center',
  },

  primaryButtonText: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background, // Dark text on bright green button
  },

  hintText: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
  },

  // ── Question phase layout ─────────────────────────────────────────────────
  questionContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xxxl,
    gap: SPACING.xl,
  },

  animalEmojiSmall: {
    fontSize: 48,  // Smaller reminder emoji — gives context without dominating
    lineHeight: 56,
  },

  questionText: {
    fontFamily: FONTS.display,
    fontSize: 22,
    color: COLORS.textPrimary,
    textAlign: 'center',
    lineHeight: 30,
  },

  // 2×2 grid: we use flexWrap so two buttons sit side by side per row
  answersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    width: '100%',
    justifyContent: 'center',
  },

  // Each button takes up ~half the row width minus gap
  // We wrap Animated.View (for color) around a Pressable (for tap events)
  answerButtonWrapper: {
    width: '47%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden', // Clip the Pressable ripple inside the rounded border
  },

  answerButtonInner: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70, // Ensure tappable area is comfortably large
  },

  answerButtonText: {
    fontFamily: FONTS.bodyMedium,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 21,
  },

  resultText: {
    fontFamily: FONTS.body,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },
});
