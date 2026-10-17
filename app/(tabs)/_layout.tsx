// ─── Tab Bar Layout ────────────────────────────────────────────────────────────
//
// 5-tab navigation — each tab maps to a user intent:
//   Protect  → all blocking configuration (purple)
//   Today    → daily status + focus CTA (green)
//   Calm     → recovery tools when struggling (amber) — breathing, grounding,
//              waiting room. No games here anymore; Arcade is its own tab so
//              "I want a distraction" and "I'm struggling" aren't the same button.
//   Arcade   → all games, browsable any time (violet)
//   Me       → stats, insights, settings (cyan)
//
// Active-tab indicator: a small color bar above the icon, a pill background
// behind the icon, and a bold/colored label — three redundant signals so the
// current tab reads at a glance without having to study it. Bar shape and
// icon visibility stay identical across all tabs (previously Calm collapsed
// the bar and hid the other icons entirely, which made it hard to tell the
// other tabs were still there and tappable).
//
// Header "?" button — each tab reopens ITS OWN <PageGuide/> (a short,
// page-specific explainer) rather than a single combined help screen. The
// guide auto-shows once per install already; tapping "?" just re-requests
// it via useUserStore.requestGuideReopen(page), keyed by the same page id
// each screen's <PageGuide page="..."/> uses.

import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable, View, Text } from 'react-native';
import { FloatingCompanion } from '@/components/page/FloatingCompanion';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/useThemeStore';
import { useUserStore } from '@/stores/useUserStore';
import { resolveSkinPalette } from '@/constants/packs/resolve';
import { useActivePack } from '@/hooks/usePack';
import { usePackStore } from '@/stores/usePackStore';
import { FONTS } from '@/constants/Colors';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { themeId, themeBrightness } = useThemeStore();
  const pack = useActivePack();
  const accentOverride = usePackStore((s) => s.accentOverride);
  const colors = resolveSkinPalette(themeId, themeBrightness, pack, accentOverride);
  const requestGuideReopen = useUserStore((s) => s.requestGuideReopen);

  // Tab definitions use live theme colors — updates whenever theme changes.
  // guidePage must match the `page` prop each tab's own <PageGuide/> uses.
  const TABS: {
    name: string;
    title: string;
    icon: FeatherName;
    color: string;
    pillBg: string;
    guidePage: string;
  }[] = [
    {
      name:      'blocklist',
      title:     'Protect',
      icon:      'shield',
      color:     colors.protect,
      pillBg:    colors.protect + '22',
      guidePage: 'blocklist',
    },
    {
      name:      'calm',
      title:     'Calm',
      icon:      'wind',
      color:     colors.calm,
      pillBg:    colors.warningDim,
      guidePage: 'calm',
    },
    {
      // Center tab (3rd of 5) — the home/status tab, given the middle slot
      // since it's the one most people land on and return to most often.
      name:      'index',
      title:     'Today',
      icon:      'home',
      color:     colors.accent,
      pillBg:    colors.accentDim,
      guidePage: 'home',
    },
    {
      name:      'arcade',
      title:     'Arcade',
      icon:      'zap',
      color:     colors.arcade,
      pillBg:    colors.arcade + '22',
      guidePage: 'arcade',
    },
    {
      name:      'profile',
      title:     'Me',
      icon:      'user',
      color:     colors.me,
      pillBg:    colors.me + '22',
      guidePage: 'profile',
    },
  ];

  // Five tabs, one intent each —
  //   Protect → set up blocking · Briefing → read the finite daily batch ·
  //   Today → status + "Need a minute" (centre) · Unwind → do something better
  //   (urge tools, games, journal) · Me → stats and settings.
  // Arcade stays a route (opened from Unwind, Today and the tempted sheet).
  const FEED_TAB = {
    name: 'feed', title: 'Briefing', icon: 'sunrise' as FeatherName,
    color: colors.calm, pillBg: colors.warningDim, guidePage: 'feed',
  };
  const byName = (n: string) => [...TABS, FEED_TAB].find((x) => x.name === n)!;
  const visible = ['blocklist', 'feed', 'index', 'calm', 'profile'].map(byName).map((x) =>
    x.name === 'calm' ? { ...x, title: 'Unwind' } : x);
  const hiddenTabs = ['arcade'];

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 4,
        },
        tabBarShowLabel: true,
      }}
    >
      {visible.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            headerTintColor: tab.color,     // Page header accent matches tab color
            headerRight: () => (
              <Pressable
                onPress={() => requestGuideReopen(tab.guidePage)}
                style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                hitSlop={8}
              >
                <Feather name="help-circle" size={22} color={colors.textMuted} />
              </Pressable>
            ),
            tabBarIcon: ({ focused, size }) => (
              <View style={{ alignItems: 'center' }}>
                <View
                  style={{
                    width: 16,
                    height: 3,
                    borderRadius: 2,
                    marginBottom: 4,
                    backgroundColor: tab.color,
                    opacity: focused ? 1 : 0,
                  }}
                />
                <View
                  style={
                    focused
                      ? {
                          backgroundColor: tab.pillBg,
                          borderRadius: 20,
                          paddingHorizontal: 12,
                          paddingVertical: 3,
                        }
                      : undefined
                  }
                >
                  <Feather
                    name={tab.icon}
                    size={size - 1}
                    color={focused ? tab.color : colors.textMuted}
                  />
                </View>
              </View>
            ),
            tabBarLabel: ({ focused }) => (
              <Text
                style={{
                  fontFamily:  focused ? FONTS.bodyBold : FONTS.body,
                  fontSize:    10.5,
                  marginTop:   2,
                  color:       focused ? tab.color : colors.textMuted,
                }}
              >
                {tab.title}
              </Text>
            ),
          }}
        />
      ))}
      {hiddenTabs.map((n) => (
        <Tabs.Screen key={n} name={n} options={{ href: null, title: n.charAt(0).toUpperCase() + n.slice(1) }} />
      ))}
    </Tabs>
    <FloatingCompanion />
    </View>
  );
}
