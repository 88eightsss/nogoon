// ─── LogoMark — NoGoon Tongue Logo ────────────────────────────────────────────
//
// The NoGoon logo: a stylised tongue inspired by Gengar's iconic lolling tongue.
// Geometric, minimal, not cartoonish — designed to work on merch, app icons,
// and in-app at any size from 24px to 400px.
//
// SHAPE:
//   - Wide rounded body (like a tongue sticking out)
//   - Bifurcated tip at the bottom (split into two rounded lobes)
//   - Subtle highlight arc inside the upper body for depth
//   - Indigo→purple gradient top-to-bottom
//   - Optional soft glow ring (variant='glow')
//
// USAGE:
//   <LogoMark size={80} />                    — default color gradient
//   <LogoMark size={40} variant="white" />    — white fill (for dark overlays)
//   <LogoMark size={200} variant="glow" />    — with glow ring (splash screen)

import React from 'react';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Ellipse,
  Circle,
} from 'react-native-svg';

type LogoVariant = 'color' | 'white' | 'mono' | 'glow';

interface LogoMarkProps {
  size?: number;
  variant?: LogoVariant;
}

export function LogoMark({ size = 80, variant = 'color' }: LogoMarkProps) {
  // All coordinates are defined in a 100×130 viewBox so the shape
  // scales perfectly to any size prop without distortion.
  const W = 100;
  const H = 130;

  // ── Color logic based on variant ────────────────────────────────────────────
  const isWhite = variant === 'white';
  const isMono  = variant === 'mono';
  const isGlow  = variant === 'glow';

  // Fill colors
  const topColor    = isWhite ? '#ffffff' : isMono ? '#555566' : '#2e2787';
  const bottomColor = isWhite ? '#ffffff' : isMono ? '#aaaacc' : '#9d7cff';
  const highlightColor = isWhite ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.18)';
  const glowColor   = 'rgba(91,82,240,0.25)';

  return (
    <Svg
      width={size}
      height={size * (H / W)}
      viewBox={`0 0 ${W} ${H}`}
    >
      <Defs>
        {/* Main gradient — indigo at top, purple at bottom */}
        <LinearGradient id="tongueGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={topColor} />
          <Stop offset="100%" stopColor={bottomColor} />
        </LinearGradient>

        {/* Highlight gradient — subtle light sheen on upper portion */}
        <LinearGradient id="highlightGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={highlightColor} stopOpacity="1" />
          <Stop offset="100%" stopColor={highlightColor} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* ── Glow ring (only for 'glow' variant — splash screen) ── */}
      {isGlow && (
        <>
          <Ellipse
            cx={W / 2} cy={H / 2}
            rx={52} ry={66}
            fill={glowColor}
          />
          <Ellipse
            cx={W / 2} cy={H / 2}
            rx={44} ry={56}
            fill={glowColor}
          />
        </>
      )}

      {/* ── Main tongue body ────────────────────────────────────────────────────
          Shape breakdown:
            - Top: rounded arch (the part that would show between lips)
            - Body: wide rectangle-ish middle
            - Bottom: two rounded lobes separated by a V-notch (the split tip)

          SVG path using cubic bezier curves for smooth organic shape.
          M  = move to start point
          C  = cubic bezier curve (control1, control2, end)
          Q  = quadratic bezier curve (control, end)
          Z  = close path
      ── */}
      <Path
        d={`
          M 50 8
          C 22 8, 12 28, 12 52
          L 12 88
          C 12 100, 20 110, 32 114
          Q 38 116, 42 112
          Q 46 108, 50 105
          Q 54 108, 58 112
          Q 62 116, 68 114
          C 80 110, 88 100, 88 88
          L 88 52
          C 88 28, 78 8, 50 8
          Z
        `}
        fill="url(#tongueGrad)"
      />

      {/* ── Inner highlight arc ──────────────────────────────────────────────────
          A thin curved ellipse in the upper portion creates the illusion of
          a rounded 3D surface — like light reflecting off the top of the tongue.
          Positioned at ~25% from the top, covering ~45% of the width.
      ── */}
      <Path
        d={`
          M 30 42
          Q 50 28, 70 42
        `}
        stroke={highlightColor}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.7}
      />

      {/* ── Center split line ────────────────────────────────────────────────────
          The defining characteristic of a tongue — the shallow groove running
          down the center. Subtle so it reads as a shape, not a cartoon detail.
      ── */}
      <Path
        d={`
          M 50 72
          Q 50 90, 50 105
        `}
        stroke={highlightColor}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
    </Svg>
  );
}
