// ─── Home Screen — mode router ───────────────────────────────────────────────
//
// Two home screen modes, switched from the Me screen (Appearance → Home
// screen): 'companion' (default) shows the mascot front and center;
// 'organizer' shows the customizable bubble/widget grid for people who'd
// rather not have a pet there. Actual screens live in components/home/.

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
