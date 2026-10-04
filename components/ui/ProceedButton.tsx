// ─── ProceedButton ────────────────────────────────────────────────────────────
//
// A button that's locked for `delaySeconds` (default 3) after mount.
// Shows a countdown in the label so the user knows when they can tap.
// Once the timer expires the button becomes fully active.
//
// Usage:
//   <ProceedButton onPress={() => onComplete(score)} label="Continue →" />
//
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { FONTS } from '@/constants/Colors';
import { useThemedColors, type ArcadeColors } from '@/hooks/useThemedColors';
import { SPACING, RADIUS } from '@/constants/Spacing';

interface ProceedButtonProps {
  onPress: () => void;
  label?: string;
  delaySeconds?: number;
  /** Override the outer container style (width, margin, etc.) */
  style?: object;
}

export function ProceedButton({
  onPress,
  label = 'Continue →',
  delaySeconds = 3,
  style,
}: ProceedButtonProps) {
  const COLORS = useThemedColors();
  const styles = useMemo(() => makeStyles(COLORS), [COLORS]);
  const [remaining, setRemaining] = useState(delaySeconds);
  const ready = remaining === 0;

  useEffect(() => {
    if (delaySeconds === 0) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { clearInterval(id); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <Pressable
      style={[styles.button, !ready && styles.buttonLocked, style]}
      onPress={ready ? onPress : undefined}
      disabled={!ready}
    >
      <Text style={[styles.label, !ready && styles.labelLocked]}>
        {ready ? label : `${remaining}s…`}
      </Text>
    </Pressable>
  );
}

const makeStyles = (COLORS: ArcadeColors) => StyleSheet.create({
  button: {
    backgroundColor: COLORS.indigoBright,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    alignItems: 'center',
  },
  buttonLocked: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 17,
    color: COLORS.background,
  },
  labelLocked: {
    color: COLORS.textMuted,
    fontFamily: FONTS.mono,
    fontSize: 15,
  },
});
