// ─── Home Screen — mode router ───────────────────────────────────────────────
//
// Two home screen modes, switched from the Me screen (Appearance → Home
// screen): 'companion' (default) shows the mascot front and center;
// 'organizer' shows the customizable bubble/widget grid for people who'd
// rather not have a pet there. Actual screens live in components/home/.
//
// First-time users are auto-dropped into the full interactive tutorial
// (app/tutorial.tsx) the moment they land here after onboarding — the
// tutorial file itself already documented this as its entry point
// ("Auto-shown after onboarding when hasSeenTutorial is false") but nothing
// ever actually triggered it, so it just sat there unreachable except via
// the small "take the full tour" link inside the per-tab PageGuide.

import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useThemeStore } from '@/stores/useThemeStore';
import { useTheme } from '@/hooks/useTheme';
import { useUserStore } from '@/stores/useUserStore';
import { HomeCompanion } from '@/components/home/HomeCompanion';
import { HomeOrganizer } from '@/components/home/HomeOrganizer';
import { PageGuide } from '@/components/PageGuide';

export default function HomeScreen() {
  const { homeMode } = useThemeStore();
  const { colors } = useTheme();
  const hasOnboarded = useUserStore((s) => s.hasOnboarded);
  const hasSeenTutorial = useUserStore((s) => s.hasSeenTutorial);

  const triggeredRef = useRef(false);
  useEffect(() => {
    if (triggeredRef.current) return;
    if (!hasOnboarded || hasSeenTutorial) return;
    triggeredRef.current = true;
    // Small delay so the tab transition settles before the tutorial slides in.
    const t = setTimeout(() => router.push('/tutorial'), 500);
    return () => clearTimeout(t);
  }, [hasOnboarded, hasSeenTutorial]);

  return (
    <>
      {homeMode === 'organizer' ? <HomeOrganizer /> : <HomeCompanion />}
      <PageGuide
        page="home"
        icon="home"
        accent={colors.accent}
        title="Today"
        subtitle="Your daily snapshot — streak, blocklist, and quick stats, all in one glance."
        points={[
          { icon: 'zap',          title: 'Streak ring',        body: "Counts every day you don't give in. Keep it going." },
          { icon: 'shield',       title: "Today's blocklist",  body: "Shows what's currently blocked and since when." },
          { icon: 'bar-chart-2',  title: 'Quick stats',        body: 'Longest streak and hours reclaimed, updated as you go.' },
        ]}
      />
    </>
  );
}
