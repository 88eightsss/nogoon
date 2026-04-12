// ─── Tab Bar Layout ────────────────────────────────────────────────────────────
//
// Controls the bottom navigation strip with 4 tabs.
// Uses Feather icons (included in @expo/vector-icons) — thinner and more modern
// than the default Ionicons set.
//
// TAB COLOR SYSTEM:
//   Home     → indigo bright (#5b52f0) — primary brand
//   Blocklist→ indigo bright (#5b52f0) — primary brand
//   Arcade   → purple (#9d7cff)        — games/fun
//   Profile  → cyan (#00d4ff)          — personal/identity

import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/Colors';

// Feather icon name type
type FeatherName = React.ComponentProps<typeof Feather>['name'];

// Tab configuration — one object per tab makes adding/reordering easy
const TABS: {
  name: string;
  title: string;
  icon: FeatherName;       // Feather uses the same icon for active/inactive
  color: string;           // Active tint color for this tab
}[] = [
  {
    name:  'index',
    title: 'Home',
    icon:  'home',
    color: COLORS.indigoBright,
  },
  {
    name:  'blocklist',
    title: 'Block',
    icon:  'shield',
    color: COLORS.indigoBright,
  },
  {
    name:  'arcade',
    title: 'Arcade',
    icon:  'zap',           // Lightning bolt — energy/games
    color: COLORS.purple,
  },
  {
    name:  'profile',
    title: 'Profile',
    icon:  'user',
    color: COLORS.cyan,
  },
];

export default function TabsLayout() {
  // insets.bottom = height of Android gesture nav bar / iOS home indicator.
  // Adding it to the tab bar height pushes tabs above the system UI.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // We build our own headers on each screen
        headerShown: false,

        // Tab bar dark theme — matches app background with subtle top border
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
        },

        // Inactive tabs are dimmed
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarActiveTintColor: tab.color,

            // Feather renders same icon always — we control opacity via color
            tabBarIcon: ({ color, size }) => (
              <Feather
                name={tab.icon}
                size={size - 1}  // Feather strokes look slightly large at default size
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
