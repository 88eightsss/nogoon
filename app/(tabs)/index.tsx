// ─── Home Screen — mode router ───────────────────────────────────────────────
//
// Two home screen modes, switched from the Me screen (Appearance → Home
// screen): 'companion' (default) shows the mascot front and center;
// 'organizer' shows the customizable bubble/widget grid for people who'd
// rather not have a pet there. Actual screens live in components/home/.
//
// First-time users are NOT dropped into the full interactive tutorial
// (app/tutorial.tsx) any more. Right after onboarding that was a second wall
// of text on top of everything else. Instead the Today screen shows the same
// small "New here?" bubble every tab has (see components/PageGuide.tsx); the
// guide it opens links to the full tour for anyone who wants it.

import { useThemeStore } from '@/stores/useThemeStore';
import { useTheme } from '@/hooks/useTheme';
import { HomeCompanion } from '@/components/home/HomeCompanion';
import { HomeOrganizer } from '@/components/home/HomeOrganizer';
import { PageGuide } from '@/components/PageGuide';

export default function HomeScreen() {
  const { homeMode } = useThemeStore();
  const { colors } = useTheme();

  return (
    <>
      {homeMode === 'organizer' ? <HomeOrganizer /> : <HomeCompanion />}
      <PageGuide
        page="home"
        icon="home"
        accent={colors.accent}
        title="Today"
        hint="Your daily snapshot"
        subtitle="Your companion, protection status and streak."
        points={[
          { icon: 'heart',        title: 'Your companion',     body: 'Grows each time you walk away.' },
          { icon: 'shield',       title: 'Protection status',  body: 'Shows if blocking is on — tap to fix it.' },
          { icon: 'award',        title: 'Your progress',      body: 'Walk-aways banked and streak freezes earned.' },
        ]}
      />
    </>
  );
}
