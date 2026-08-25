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
import { COLORS } from '@/constants/Colors';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

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
    color:  COLORS.purple,
    pillBg: COLORS.purpleDim,
  },
  {
    name:   'index',
    title:  'Today',
    icon:   'home',
    color:  COLORS.green,
    pillBg: COLORS.greenDim,
  },
  {
    name:   'calm',
    title:  'Calm',
    icon:   'wind',
    color:  COLORS.warning,
    pillBg: COLORS.warningDim,
  },
  {
    name:   'profile',
    title:  'Me',
    icon:   'user',
    color:  COLORS.cyan,
    pillBg: COLORS.cyanDim,
  },
  // Arcade lives inside Calm — hidden from tab bar
  {
    name:   'arcade',
    title:  'Arcade',
    icon:   'zap',
    color:  COLORS.arcade,
    pillBg: COLORS.arcadeDim,
    hidden: true,
  },
];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.background },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable
            onPress={() => router.push('/help')}
            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
            hitSlop={8}
          >
            <Feather name="help-circle" size={22} color={COLORS.textMuted} />
          </Pressable>
        ),
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
        },
        // Inactive tabs keep their own color (slightly muted via opacity)
        // — handled per-tab below so each stays distinct
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
