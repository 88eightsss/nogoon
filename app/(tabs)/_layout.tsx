// ─── Tab Bar Layout ────────────────────────────────────────────────────────────
//
// 4-tab navigation — each tab maps to a user intent:
//   Protect  → all blocking configuration (purple)
//   Today    → daily status + focus CTA (green)
//   Calm     → recovery tools when struggling (amber)
//   Me       → stats, insights, settings (cyan)
//
// Arcade lives inside Calm — hidden from tab bar.

import { Tabs, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '@/stores/useThemeStore';
import { THEMES } from '@/constants/Themes';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { themeId } = useThemeStore();
  const colors = THEMES[themeId];

  // Tab definitions use live theme colors — updates whenever theme changes
  const TABS: {
    name: string;
    title: string;
    icon: FeatherName;
    color: string;
    pillBg: string;
    hidden?: boolean;
  }[] = [
    {
      name:   'blocklist',
      title:  'Protect',
      icon:   'shield',
      color:  colors.protect,
      pillBg: colors.protect + '22',
    },
    {
      name:   'index',
      title:  'Today',
      icon:   'home',
      color:  colors.accent,
      pillBg: colors.accentDim,
    },
    {
      name:   'calm',
      title:  'Calm',
      icon:   'wind',
      color:  colors.calm,
      pillBg: colors.warningDim,
    },
    {
      name:   'profile',
      title:  'Me',
      icon:   'user',
      color:  colors.me,
      pillBg: colors.me + '22',
    },
    // Arcade lives inside Calm — hidden from tab bar
    {
      name:   'arcade',
      title:  'Arcade',
      icon:   'zap',
      color:  colors.arcade,
      pillBg: colors.arcade + '22',
      hidden: true,
    },
  ];

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/help')}
            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
            hitSlop={8}
          >
            <Feather name="help-circle" size={22} color={colors.textMuted} />
          </Pressable>
        ),
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
        },
        tabBarInactiveTintColor: 'transparent',
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarActiveTintColor: tab.color,
            headerTintColor: tab.color,     // Page header accent matches tab color
            tabBarItemStyle: tab.hidden ? { display: 'none' } : undefined,
            tabBarIcon: ({ focused, size }) => (
              <View style={focused ? {
                backgroundColor: tab.pillBg,
                borderRadius: 20,
                paddingHorizontal: 12,
                paddingVertical: 3,
              } : undefined}>
                <Feather
                  name={tab.icon}
                  size={size - 1}
                  color={focused ? tab.color : tab.color + 'AA'} // inactive = 67% opacity
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
