// ─── Tab Bar Layout ────────────────────────────────────────────────────────────
//
// 4-tab navigation — each tab maps to a user intent:
//   Briefing → the finite daily read (amber)
//   Today    → daily status + focus CTA (green)
//   Unwind   → recovery tools when struggling (amber) — breathing, grounding,
//              waiting room, games, journal.
//   Me       → Protection (blocking), Customize, Progress, Account (cyan)
// The old Protect and Arcade tabs are still routes (opened from Me, Today and the tempted sheet);
// they just are not in the bar.
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
import { TabCoach } from '@/components/tour/TabCoach';
import { PackSprite } from '@/components/page/PackSprite';
import { useMascot } from '@/components/page/useCharacter';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/useThemeStore';
import { useUserStore } from '@/stores/useUserStore';
import { resolveSkinPalette } from '@/constants/packs/resolve';
import { useActivePack } from '@/hooks/usePack';
import { usePackStore } from '@/stores/usePackStore';
import { FONTS } from '@/constants/Colors';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

// "Raised Today" tab bar: the centre tab is a round button showing the active companion.
function RaisedToday({ focused, color, ring }: { focused: boolean; color: string; ring: string }) {
  const { char, stage } = useMascot();
  return (
    <View
      style={{
        width: 54, height: 54, borderRadius: 27, marginTop: -22, alignItems: 'center', justifyContent: 'center',
        backgroundColor: focused ? color : color + '33', borderWidth: 3, borderColor: ring,
        shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 5,
      }}
    >
      <PackSprite char={char} stage={stage} cell={3} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { themeId, themeBrightness } = useThemeStore();
  const pack = useActivePack();
  const accentOverride = usePackStore((s) => s.accentOverride);
  const colors = resolveSkinPalette(themeId, themeBrightness, pack, accentOverride);
  const requestGuideReopen = useUserStore((s) => s.requestGuideReopen);
  // The raised centre button needs an odd number of tabs; with four there is no centre slot.
  const raised = false;

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
      icon:      'shield',
      color:     colors.me,
      pillBg:    colors.me + '22',
      guidePage: 'profile',
    },
  ];

  // Four tabs, one intent each —
  //   Briefing → read the finite daily batch · Today → status + "Need a minute" ·
  //   Unwind → do something better (urge tools, games, journal) ·
  //   Me → protection (blocking), customizing, progress and account.
  // Arcade and Protect's old screen (Apps & sites) stay routes, opened from Unwind, Today, Me and the tempted sheet.
  const FEED_TAB = {
    name: 'feed', title: 'Briefing', icon: 'sunrise' as FeatherName,
    color: colors.calm, pillBg: colors.warningDim, guidePage: 'feed',
  };
  const byName = (n: string) => [...TABS, FEED_TAB].find((x) => x.name === n)!;
  const visible = ['feed', 'index', 'calm', 'profile'].map(byName).map((x) =>
    x.name === 'calm' ? { ...x, title: 'Unwind' } : x);
  const hiddenTabs = ['arcade', 'blocklist'];

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      backBehavior="history"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: (raised ? 76 : 60) + insets.bottom,
          paddingTop: raised ? 14 : 6,
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
            tabBarIcon: ({ focused, size }) => (raised && tab.name === 'index') ? (
              <RaisedToday focused={focused} color={tab.color} ring={colors.background} />
            ) : (
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
                  {tab.name === 'profile' ? (
                    <View style={{ width: size - 1, height: size - 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Feather name="shield" size={size - 1} color={focused ? tab.color : colors.textMuted} />
                      <Feather
                        name="user"
                        size={Math.round((size - 1) * 0.5)}
                        color={focused ? tab.color : colors.textMuted}
                        style={{ position: 'absolute', top: Math.round((size - 1) * 0.26) }}
                      />
                    </View>
                  ) : (
                    <Feather
                      name={tab.icon}
                      size={size - 1}
                      color={focused ? tab.color : colors.textMuted}
                    />
                  )}
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
        <Tabs.Screen key={n} name={n} options={{ href: null, title: n === 'blocklist' ? 'Apps & sites' : n.charAt(0).toUpperCase() + n.slice(1) }} />
      ))}
    </Tabs>
    <FloatingCompanion />
    <TabCoach />
    </View>
  );
}
