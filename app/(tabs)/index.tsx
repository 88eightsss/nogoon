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
import { PageGuide, type PageGuideStat } from '@/components/PageGuide';
import { useUserStore, getMinutesSaved } from '@/stores/useUserStore';
import { getLocalDateKey } from '@/utils/date';
import { usePackStore } from '@/stores/usePackStore';
import { MyPage } from '@/components/page/MyPage';

export default function HomeScreen() {
  const { homeMode } = useThemeStore();
  const newHome = usePackStore((s) => s.newHome);
  const { colors } = useTheme();

  // Live numbers for the first-visit "Your daily snapshot" bubble.
  const streak         = useUserStore((s) => s.streak);
  const longestStreak  = useUserStore((s) => s.longestStreak);
  const walkAwayCount  = useUserStore((s) => s.walkAwayCount);
  const dailyGames     = useUserStore((s) => s.dailyGames);
  const openCounts     = useUserStore((s) => s.openCounts);
  const openCountDate  = useUserStore((s) => s.openCountDate);
  const blocklist      = useUserStore((s) => s.blocklist);
  const blockedApps    = useUserStore((s) => s.blockedApps);

  // Date-keyed counts roll over by themselves at midnight (weeklyActivity[6] doesn't).
  const gamesToday = dailyGames?.[getLocalDateKey()] ?? 0;
  const gamesWeek  = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return dailyGames?.[getLocalDateKey(d)] ?? 0;
  }).reduce((a, b) => a + b, 0);
  const gateStopsToday = openCountDate === getLocalDateKey()
    ? Object.values(openCounts ?? {}).reduce((a, b) => a + b, 0)
    : 0;
  const minutesSaved = getMinutesSaved(walkAwayCount);
  const plural = (n: number, one: string, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;

  const stats: PageGuideStat[] = [
    { icon: 'zap',      value: plural(streak, 'day'),            label: `Current streak \u00b7 best ${longestStreak}` },
    { icon: 'award',    value: plural(walkAwayCount, 'walk-away'), label: 'Times you chose to walk away' },
    { icon: 'clock',    value: minutesSaved >= 60 ? `~${Math.round(minutesSaved / 60)} hrs` : `~${minutesSaved} min`, label: 'Attention reclaimed' },
    { icon: 'lock',     value: plural(gateStopsToday, 'stop'),   label: 'Gate stops today' },
    { icon: 'target',   value: plural(gamesToday, 'game'),       label: `Played today \u00b7 ${gamesWeek} this week` },
    { icon: 'slash',    value: `${plural(blocklist.length, 'site')} \u00b7 ${plural(blockedApps.length, 'app')}`, label: 'Currently blocked' },
  ];

  return (
    <>
      {newHome ? <MyPage /> : homeMode === 'organizer' ? <HomeOrganizer /> : <HomeCompanion />}
      <PageGuide
        page="home"
        icon="home"
        accent={colors.accent}
        title="Today"
        hint="Your daily snapshot"
        subtitle="Your companion, protection status and streak."
        snapshot={{ title: 'Today', subtitle: 'Where you stand right now.', stats }}
        points={[
          { icon: 'heart',        title: 'Your companion',     body: 'Grows each time you walk away.' },
          { icon: 'shield',       title: 'Protection status',  body: 'Shows if blocking is on — tap to fix it.' },
          { icon: 'award',        title: 'Your progress',      body: 'Walk-aways banked and streak freezes earned.' },
        ]}
      />
    </>
  );
}
