// Tab bar layout — controls the bottom navigation strip with 4 tabs.
// Each tab has a filled icon when active and an outline icon when inactive.
// Ionicons come bundled with Expo — no extra install needed.

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '@/constants/Colors';

// Helper type so TypeScript knows what icon names are valid
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Tab configuration in one place so it's easy to add more tabs later
const TABS: {
  name: string;
  title: string;
  icon: IoniconName;       // Filled icon — used when the tab is active
  iconOutline: IoniconName; // Outline icon — used when the tab is inactive
  color: string;
}[] = [
  {
    name: 'index',
    title: 'Home',
    icon: 'home',
    iconOutline: 'home-outline',
    color: COLORS.green,
  },
  {
    name: 'blocklist',
    title: 'Blocklist',
    icon: 'shield',
    iconOutline: 'shield-outline',
    color: COLORS.green,
  },
  {
    name: 'arcade',
    title: 'Arcade',
    icon: 'game-controller',
    iconOutline: 'game-controller-outline',
    color: COLORS.purple,
  },
  {
    name: 'profile',
    title: 'Profile',
    icon: 'person',
    iconOutline: 'person-outline',
    color: COLORS.cyan,
  },
];

export default function TabsLayout() {
  // insets.bottom is the height of Android's gesture navigation bar (or iOS home indicator).
  // Adding it to the tab bar height pushes the tabs up above the system UI.
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // We build our own headers, so hide the default one
        headerShown: false,

        // Tab bar background and border match GATE's dark theme.
        // height = 60px for the tabs + however tall the system nav bar is.
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 4,
        },

        // Unselected tabs are dimmed
        tabBarInactiveTintColor: COLORS.textMuted,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,

            // Active tab uses the accent color for this section
            tabBarActiveTintColor: tab.color,

            // Switch between filled (active) and outline (inactive) icons
            tabBarIcon: ({ focused, color, size }) => (
              <Ionicons
                name={focused ? tab.icon : tab.iconOutline}
                size={size}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
