# NoGoon — Update Handoff (Session 2)

**Created:** May 18, 2026
**Previous handoff:** May 13, 2026 (HANDOFF.md in project root)
**Owner:** Jordan (jtshibao@gmail.com)
**Repo:** https://github.com/88eightsss/nogoon.git

---

## What This Document Covers

Everything done SINCE the last handoff (May 13). If you're starting fresh, read the original `HANDOFF.md` in the project root first — it covers the full architecture, design system, file inventory, env setup, and Supabase schema. This document only covers what changed.

---

## 1. What Was Completed This Session

### ✅ In-App Help Button + Setup Guide Screen
Added a persistent help button on the home screen so users can always get back to the Accessibility Service setup instructions — not just during onboarding.

**Files created:**
- `app/setup-guide.tsx` — Standalone help screen with:
  - Real-time service status detection (green = active, pink = inactive)
  - "Open Settings" button when service is off
  - 6-step numbered setup instructions
  - Privacy note with lock icon
  - Troubleshooting section (3 common issues)
  - Uses AppState listener to auto-detect when user returns from Android Settings

**Files modified:**
- `app/_layout.tsx` — Added Stack.Screen route for setup-guide as modal with slide_from_bottom animation
- `app/(tabs)/index.tsx` — Added help button below ShieldStatus component linking to `/setup-guide`

### ✅ Accessibility Service Improvements (Kotlin)
Expanded browser support and fixed a memory leak.

**File modified:** `android/app/src/main/java/com/nogoon/app/NoGoonAccessibilityService.kt`
- Added 3 new browsers to `browserPackages` and `neverBlock` sets:
  - Vivaldi (`com.vivaldi.browser`)
  - DuckDuckGo (`com.duckduckgo.mobile.android`)
  - Kiwi Browser (`com.kiwibrowser.browser`)
- Added URL bar IDs for each new browser
- **Fixed memory leak:** `rootNode.recycle()` in `handleBrowserUrl` is now wrapped in `try/finally` so it always gets recycled even on early returns or exceptions

### ✅ AppBlockerModule.kt Sync
**File modified:** `android/app/src/main/java/com/nogoon/app/AppBlockerModule.kt`
- The build folder version was missing `setTemporaryUnlock` and `clearTemporaryUnlock` methods that existed in the android-src/ reference copy
- Copied the complete 9.8KB reference version to replace the incomplete 7.6KB build version
- These methods are essential for the "unlock for 10 minutes" feature after playing a game

### ✅ Play Store Accessibility Service Declaration
**File created:** `docs/play-store-accessibility-declaration.md`
- Full Q&A format matching Google Play Console requirements (6 detailed answers)
- Covers: what the service does, why it's needed (with alternatives considered), what data it accesses, data transmission (none — all on-device), core functionality requirement, user consent
- Includes short-form declaration for single text fields
- Video demonstration instructions for Google review

### ✅ Complete Play Store Listing
**File created:** `docs/play-store-listing.md`
- 7 comprehensive sections:
  1. **App details** — app name, short description (80 chars), full description (4000 chars with ASO keywords)
  2. **Content rating questionnaire** — IARC answers (expected rating: Everyone / PEGI 3)
  3. **Target audience** — 18+ (avoids COPPA requirements)
  4. **Data safety section** — every data type mapped (collected/not collected/shared)
  5. **Screenshot plan** — 8 screenshots with headlines, layout descriptions, and style guide
  6. **Required assets** — dimensions and format for icon, feature graphic, screenshots, optional video
  7. **Launch checklist** — 40+ items from EAS build through publishing, including:
     - In-app purchase setup (3 subscriptions + 3 point packs with exact product IDs and prices)
     - Testing track progression (internal → closed beta → production)
     - Post-publishing tasks (Discord, Reddit strategy, review monitoring)

### ✅ Free Pro Access Launch Promo (3 Months)
Implemented a date-gated system that gives ALL users free Pro access until September 1, 2026. This lets the app build a user base before requiring payment.

**File modified:** `stores/useSubscriptionStore.ts`
- Added at top of file:
  ```typescript
  const LAUNCH_PROMO_END = new Date('2026-09-01T00:00:00Z');

  export function isLaunchPromoActive(): boolean {
    return new Date() < LAUNCH_PROMO_END;
  }

  export function launchPromoDaysLeft(): number {
    const now = new Date();
    const diff = LAUNCH_PROMO_END.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }
  ```
- `initialize()` — Pro status priority chain: dev mode → launch promo → RevenueCat. Even if RevenueCat fails (no internet), promo still grants Pro.
- `refresh()` — Short-circuits and keeps `isPro: true` during the promo period.
- **To extend the promo:** Change the date on line 31. **To end early:** Set it to a past date.

**File modified:** `app/paywall.tsx`
- Added import for `isLaunchPromoActive` and `launchPromoDaysLeft`
- Added lime-colored promo banner at top: "Pro is FREE during launch!" with days-remaining countdown
- "Already subscribed" badge now says "Pro access active — free during launch ✓" during promo
- Added styles: `promoBanner`, `promoEmoji`, `promoTextGroup`, `promoTitle`, `promoSub`

**File modified:** `app/(tabs)/profile.tsx`
- Added import for `isLaunchPromoActive` and `launchPromoDaysLeft`
- Pro status badge turns lime (instead of purple) during promo
- Shows "Pro · Free during launch 🎉" with days-remaining countdown
- Added `proActiveSubtext` style

**Cascading effect — no other changes needed:**
All 16 files that check `isPro` read from the same Zustand store. Since the store says `true` during the promo, everything unlocks automatically: all mini-games, no ads (AdBanner returns null when isPro), streak protection, custom game durations, weekly insights, etc.

### ✅ Security & Optimization Audit
Ran a full codebase audit. Here are the findings:

---

## 2. Security Audit Findings (NOT YET FIXED)

### 🔴 CRITICAL — Fix Before Launch

1. **Partner notification Edge Function: no auth verification**
   - File: `supabase/functions/notify-partner/index.ts`, line 43
   - Issue: The function accepts a `userId` from the request body and trusts it. Anyone with the Supabase anon key can impersonate any user and trigger partner emails.
   - Fix: Extract user ID from the Authorization JWT header instead of the body.

2. **HTML injection in partner emails (XSS)**
   - File: `supabase/functions/notify-partner/index.ts`, lines 86-124
   - Issue: `userName`, `partnerName`, and `domain` are inserted directly into email HTML without escaping. A user could inject scripts or phishing content into emails sent to partners.
   - Fix: Escape all user-provided text before inserting into HTML.

3. **Supabase writes fail silently — data loss risk**
   - File: `stores/useUserStore.ts`, lines 350-358, 376-384, 393-406, 507-515
   - Issue: All background Supabase writes (game_sessions, blocklist, journal_entries) use `.then()` without `.catch()` or error checking. If writes fail, local state diverges from cloud with zero visibility.
   - Fix: Add error handling and optionally a retry queue.

4. **Placeholder email in Edge Function**
   - File: `supabase/functions/notify-partner/index.ts`, line 148
   - Issue: Sender is `notifications@yourdomain.com` — emails will fail until replaced with a real verified Resend domain.

### 🟡 IMPORTANT — Fix Soon

5. **No React error boundary**
   - File: `app/_layout.tsx`
   - Issue: An unhandled JS error crashes the whole app with a white screen. Add an error boundary to show a fallback.

6. **CORS wildcard on Edge Function**
   - File: `supabase/functions/notify-partner/index.ts`, line 28
   - Issue: `Access-Control-Allow-Origin: *` allows any website to call this function. Restrict or remove since it's called from native app.

7. **Partner email not validated**
   - File: `stores/useUserStore.ts`, line 464
   - Issue: `setPartner` stores the email without calling `validateEmail()`. Malformed values flow to the Edge Function.

8. **TypeScript `any` types in purchases code**
   - Files: `lib/purchases.ts` (lines 59, 112, 129, 134), `stores/useSubscriptionStore.ts` (line 56)
   - Issue: All RevenueCat objects typed as `any`. Create proper interfaces.

9. **Rate limiting is client-side only**
   - File: `stores/useAuthStore.ts`, lines 41-76
   - Issue: Brute-force protection resets on app restart (in-memory variables). Supabase has server-side rate limiting — verify it's configured.

### 🟢 Nice to Have

10. **GameCard component not memoized** — `app/gate.tsx`, lines 152-197
11. **`buildGameOptions` called every render** — `app/gate.tsx`, line 236 (wrap in `useMemo`)
12. **`nogoon/` duplicate folder still exists** — delete manually from your computer
13. **`useEffect` missing dependency in `_layout.tsx`** — works in practice (Zustand stable refs) but technically incomplete
14. **iOS RevenueCat key is placeholder** — `.env.local` line 4, not urgent unless iOS build planned

---

## 3. Complete File Change Log (This Session)

| File | Action | What Changed |
|------|--------|-------------|
| `app/setup-guide.tsx` | **Created** | Standalone Accessibility Service help screen |
| `app/_layout.tsx` | Modified | Added Stack.Screen for setup-guide modal |
| `app/(tabs)/index.tsx` | Modified | Added help button below ShieldStatus |
| `app/(tabs)/profile.tsx` | Modified | Added launch promo badge + countdown |
| `app/paywall.tsx` | Modified | Added launch promo banner + updated Pro badge text |
| `stores/useSubscriptionStore.ts` | Modified | Added launch promo system (date gate, helpers, initialize/refresh logic) |
| `android/.../NoGoonAccessibilityService.kt` | Modified | Added 3 browsers, fixed rootNode memory leak |
| `android/.../AppBlockerModule.kt` | Modified | Synced temp unlock methods from reference copy |
| `docs/play-store-accessibility-declaration.md` | **Created** | Full Google Play Accessibility Service declaration |
| `docs/play-store-listing.md` | **Created** | Complete Play Store listing with 7 sections + 40-item checklist |

---

## 4. What Still Needs To Be Done (Priority Order)

### Before Launch
1. **Fix critical security issues** (items 1-4 from Section 2)
2. **Add React error boundary** to `_layout.tsx` (item 5)
3. **Fix Supabase profiles table** — run the ALTER TABLE SQL from the original HANDOFF.md Section 8 (if not done yet)
4. **Replace placeholder email** in Edge Function with real Resend domain
5. **Replace RevenueCat test key** with production `goog_` key in EAS Secrets
6. **Delete `nogoon/` duplicate folder** from your computer manually
7. **Delete `android-src/GateAccessibilityService.kt`** (legacy file) manually

### Play Store Submission
8. **Create Play Store assets** — app icon (512x512), feature graphic (1024x500), 5-8 screenshots
9. **EAS production build** — `npx eas build --platform android --profile preview`
10. **Test full flow** on a real device: sign up → onboarding → block site → get intercepted → play game → walk away
11. **Submit to Play Console** — follow the 40-item checklist in `docs/play-store-listing.md`
12. **Host Privacy Policy + Terms HTML** on GitHub Pages, Netlify, or Vercel

### After Launch
13. **Set up Discord server** for user feedback
14. **Begin Reddit posting strategy** (see `docs/launch-strategy.md`)
15. **Monitor Play Console** for crash reports and reviews
16. **Respond to every review** for the first month

---

## 5. Launch Promo Details

| Setting | Value |
|---------|-------|
| Promo end date | September 1, 2026 |
| What's free | All Pro features (all games, no ads, insights, custom durations, streak protection) |
| Config location | `stores/useSubscriptionStore.ts`, line 31 |
| To extend | Change the `LAUNCH_PROMO_END` date |
| To end early | Set the date to a past date |
| Auto-rollback | Yes — when the date passes, `isLaunchPromoActive()` returns false and `refresh()` checks RevenueCat for real subscription status |

---

## 6. Quick Reference

### Environment
```
EXPO_PUBLIC_SUPABASE_URL=https://hadcagughbyouagwpdhq.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...mymHV-dateubiZ_VT_ZEe_a3pUIk23uoqqXCcMZqIR4
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=test_cAEXmoziVycrJWMJaJDHdwPleDy
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_PASTE_YOUR_IOS_KEY_HERE
```

### Key Commands
```bash
npx expo start                                    # Dev server (UI only in Expo Go)
npx eas build --platform android --profile preview # Build APK with native features
npx eas login                                      # Log into EAS account
```

### Supabase
- **Dashboard:** https://supabase.com/dashboard/project/hadcagughbyouagwpdhq
- **Auth:** Sign in via GitHub

### Project IDs
- **EAS Project:** 80b5ee13-4dfd-462d-8bc3-51d022cd3e51
- **Package name:** com.nogoon.app
- **Deep link scheme:** nogoon://

---

*This update handoff was generated on May 18, 2026.*
*Use this alongside the original HANDOFF.md to resume work in a new session.*
