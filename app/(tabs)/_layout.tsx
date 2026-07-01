// ─── Tab Bar Layout ────────────────────────────────────────────────────────────
//
// Controls the bottom navigation strip with 3 tabs (Arcade moved to Home card).
// Uses Feather icons (included in @expo/vector-icons) — thinner and more modern
// than the default Ionicons set.
//
// TAB COLOR SYSTEM:
//   Block    → indigo bright (#5b52f0) — primary brand
//   Home     → indigo bright (#5b52f0) — primary brand (center)
//   Profile  → cyan (#00d4ff)          — personal/identity

import { Tabs, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable } from 'react-native';
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
    name:  'blocklist',
    title: 'Block',
    icon:  'shield',
    color: COLORS.indigoBright,
  },
  {
    name:  'index',
    title: 'Home',
    icon:  'home',
    color: COLORS.indigoBright,
  },
  {
    name:  'profile',
    title: 'Profile',
    icon:  'user',
    color: COLORS.cyan,
  },
  // Arcade is no longer a tab — it lives as a card on the Home screen
  {
    name:  'arcade',
    title: 'Arcade',
    icon:  'zap',
    color: COLORS.purple,
  },
];

export default function TabsLayout() {
  // insets.bottom = height of Android gesture nav bar / iOS home indicator.
  // Adding it to the tab bar height pushes tabs above the system UI.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.textPrimary,
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
            // Hide arcade from the tab bar — it's a Home screen card now
            tabBarItemStyle: tab.name === 'arcade' ? { display: 'none' } : undefined,

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
