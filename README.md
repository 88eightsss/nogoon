# GATE — Digital Wellness App

> Pause before you scroll. Break the loop.

GATE intercepts blocked apps and websites on Android, forces a 60-second pattern-interrupting game, then lets you decide with a clear head. Built for Gen Z, designed to actually help.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| State | Zustand + SecureStore |
| Backend | Supabase |
| Payments | RevenueCat |
| Builds | EAS Build |

---

## Getting Started (for contributors)

### 1. Prerequisites

Install these if you don't have them:

- [Node.js 18+](https://nodejs.org/) — the JavaScript runtime
- [Git](https://git-scm.com/) — version control (you probably already have this)
- [VS Code](https://code.visualstudio.com/) — recommended editor

### 2. Clone the repo

```bash
git clone https://github.com/88eightsss/nogoon.git
cd nogoon
```

### 3. Install dependencies

```bash
npm install
```

### 4. Set up environment variables

Create a file called `.env.local` in the project root and ask the project owner for the values:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

### 5. Start the dev server

```bash
npx expo start
```

This opens a QR code. Scan it with the **Expo Go** app on your phone to see the app live.

> ⚠️ **Note:** Blocking features (the core Android functionality) only work in a real build — not in Expo Go. Expo Go is fine for UI/design work.

---

## Project Structure

```
gate/
├── app/                    # Screens (expo-router file-based routing)
│   ├── (tabs)/             # Main tab screens: home, blocklist, arcade, profile
│   ├── gate.tsx            # The intercept screen (shown when a blocked app opens)
│   └── post-game.tsx       # Decision screen after playing a game
│
├── components/
│   ├── games/              # All mini-games
│   │   ├── BreathingGame.tsx
│   │   ├── GroundingExercise.tsx   ← 5-4-3-2-1 grounding technique
│   │   ├── PatternMemory.tsx
│   │   ├── ReactionGame.tsx
│   │   ├── StroopChallenge.tsx
│   │   ├── TypingChallenge.tsx
│   │   └── OddOneOut.tsx
│   ├── home/               # Home screen widgets (ShieldStatus, StreakBadge, etc.)
│   └── ui/                 # Shared UI components (Card, Badge, etc.)
│
├── stores/
│   └── useUserStore.ts     # Global state (points, streak, blocklist, etc.)
│
├── hooks/
│   └── useAppBlocker.ts    # Bridge to Android blocking service
│
├── android-src/            # Android native code (Kotlin)
│   ├── AppBlockerModule.kt           # JS ↔ Android bridge
│   └── NoGoonAccessibilityService.kt # Background service that does the blocking
│
├── constants/
│   ├── Colors.ts           # Design system colors
│   └── Spacing.ts          # Spacing + border radius values
│
└── supabase/               # Supabase edge functions + DB types
```

---

## How the Blocking Works (Android)

1. User adds a site/app to the blocklist
2. `useAppBlocker.ts` syncs the list to Android SharedPreferences
3. `NoGoonAccessibilityService.kt` runs in the background, watching every app open and every browser URL change
4. When a match is detected, it fires a deep link: `nogoon://gate?domain=...`
5. The Gate screen opens, forces a game, then user decides to walk away or unlock for 10 min

---

## Key Design Decisions

- **Pause tokens, not game currency** — costs are low (50 to unlock). The game itself is the friction, not a paywall.
- **Shock therapy framing** — the gate screen is a psychological speed bump, not a challenge to overcome
- **No guilt** — streaks are called "Intentional Days" and celebrate what you didn't do, not retention metrics
- **Walk-away count** — the real success metric. Every time someone plays and still leaves = app working as intended

---

## Building for Android

Builds are handled by [EAS Build](https://expo.dev/eas).

```bash
npx eas build --platform android --profile preview
```

> Free plan: 15 builds/month. Ask the project owner for access to the EAS project.

---

## Contributing

1. Pull the latest: `git pull origin master`
2. Make your changes
3. Test in Expo Go (UI changes) or a real build (blocking features)
4. Commit: `git commit -m "describe what you changed"`
5. Push: `git push origin master`
