# NoGoon 3.0 — Session Handoff

> Last updated: 2026-06-07
> Previous sessions: 4 (spanning 2026-05-14 to 2026-06-07)
> Author: Claude (autonomous exec mode)

---

## HOW JORDAN WORKS

**Standing instruction: "You are an executive — proceed with what you would do."**

Jordan wants autonomous execution. Don't ask clarifying questions unless truly blocked. Make decisions, execute, report results. When something needs Jordan's hands (Play Console uploads, pasting commands into PowerShell), give him the exact command or step — no explanations unless he asks.

Key behavioral notes:

- **Terse communicator** — his messages are short ("ok whats next", "yes", "can you do this for me"). Match that energy. Don't over-explain.
- **Expects results, not plans** — do the work first, show what you did after.
- **Trusts the AI fully** — he'll paste commands without questioning them, click where told. Respect that trust by being accurate.
- **PowerShell user on Windows** — his terminal is PowerShell. Use `;` to chain commands (NOT `&&`). Terminal apps are "click" tier — you can click buttons but CANNOT type commands. Use clipboard write to give him commands to paste.
- **Graphics crashes** — his computer's graphics have crashed multiple times mid-session, clearing the clipboard. If he says "nothing in my clipboard" or "same thing happened", just re-run the clipboard write.
- **OneDrive synced** — his project folder is on OneDrive. Bash sees files already on disk; if a bash command errors on a path, the file might be cloud-only — use Read tool instead.
- **Play Console account** — "Eighty Eightsss" (personal account, NOT organization). Account ID: `7686826279086048629`. App ID: `4973962173077758558`.

---

## WHAT NOGOON IS

Android app that intercepts blocked apps/websites via Accessibility Service, forces a 30-60 second pattern-interrupting mini-game, then lets the user decide whether to continue or walk away. Targets Gen Z males 16-28.

**Core philosophy:** The gate is a speed bump, not a wall. No guilt language. Streaks are "Intentional Days." Walk-away count is the real success metric.

**8 mini-games:** Stroop Challenge, Pattern Memory, Typing Test, Grounding Exercise, Breathing Reset, Why Am I Here, Reaction Speed, Odd One Out.

**Brick Mode:** Removes the unlock button entirely — play the game, then you're blocked. Period.

---

## TECH STACK

| Component | Technology |
|-----------|-----------|
| Framework | React Native + Expo SDK 54 (file-based routing) |
| Language | TypeScript strict |
| State | Zustand + expo-secure-store |
| Backend | Supabase (auth + Postgres + RLS) |
| Payments | RevenueCat (subscriptions + consumables) |
| Build | EAS Build (production .aab) |
| Native | Kotlin (Accessibility Service — gate interception) |
| Design | Y2K Dark Luxury system |
| Repo | https://github.com/88eightsss/nogoon.git |
| Branch | `master` (default) |

---

## DESIGN SYSTEM — Y2K Dark Luxury

These are non-negotiable. Breaking them undermines the app's psychology.

- **Hot pink (#ff2d9b)** = urgency/energy. **Lime (#b4ff39)** = reward/celebration. NEVER swap.
- **Green (#4ade80)** = SUCCESS ONLY (checkmarks, correct answers). Never as brand color.
- **No guilt language** — streaks are "Intentional Days." Walk-away count is the core metric.
- **Pause tokens, not game currency** — unlock costs are low (50 pts). Mini-game IS the friction, not a paywall.
- **Fonts:** Anybody 700 (display/headings), DM Sans (body), JetBrains Mono (data/counters).
- **Backgrounds:** faint purple tint. Chrome accents for premium feel.

---

## CURRENT STATUS (as of 2026-06-07)

### Play Store: RESUBMITTED FOR REVIEW

The app was initially **rejected** on 2026-06-07 because:

1. Category was "Health & Fitness" — requires organization account since Aug 2024
2. "Mental and behavioral health" was checked in Health apps declaration

**Fixed by:**
- Changed category: Health & Fitness → **Lifestyle**
- Unchecked "Mental and behavioral health"
- Checked "My app does not have any health features"
- Resubmitted 14 changes for Google review (2026-06-07)

**NOTE:** The `play-store-listing.md` file still says `Category: Health & Fitness` — this is outdated. The actual Play Console category is now **Lifestyle**. Update the file if editing it.

**Review timeline:** Up to 7 days. A daily scheduled task (`check-nogoon-beta-approval`) runs at 10 AM to check status.

### What's blocking production launch:

1. **Google review** — waiting for approval of the resubmitted closed testing release
2. **12 opted-in testers** — currently 0 opted-in (1 email added: jtshibao@gmail.com). Google requires 12 before production access.
3. **14-day closed testing period** — clock starts when the closed test goes live (after review approval)
4. **Production access application** — after 14 days + 12 testers

### Build info:

- **Current .aab:** EAS build `570deaf9`, commit `0bd92f2`, versionCode 2
- **Previous builds:** `0f1dfcc0` (versionCode 1, commit `f5b5740`), `7aaa8899` (stale code, discarded)
- **EAS profile:** `production` → `app-bundle`, `preview` → `apk`

---

## KEY REFERENCES

| Resource | Location |
|----------|----------|
| Supabase Project ID | `hadcagughbyouagwpdhq` |
| Supabase Dashboard | https://supabase.com/dashboard/project/hadcagughbyouagwpdhq |
| EAS Project ID | `80b5ee13-4dfd-462d-8bc3-51d022cd3e51` |
| Play Console Dashboard | https://play.google.com/console/u/1/developers/7686826279086048629/app/4973962173077758558/app-dashboard |
| Play Console Policy Status | https://play.google.com/console/u/1/developers/7686826279086048629/app/4973962173077758558/policy-center |
| Closed Testing Track | https://play.google.com/console/u/1/developers/7686826279086048629/app/4973962173077758558/tracks/4697881758765584229 |
| Privacy Policy | https://88eightsss.github.io/nogoon/privacy-policy.html |
| Delete Account | https://88eightsss.github.io/nogoon/legal/delete-account.html |
| RevenueCat | https://app.revenuecat.com (NoGoon project) |
| Local repo | `C:\Users\jtshi\nogoon` |
| Project folder | `C:\Users\jtshi\OneDrive\Documents\Claude\Projects\Nogoon 888 (2.0)` |

---

## MONETIZATION PLAN (Finalized)

### Subscription Tiers

**New Leaf — $2.88/mo** (was "Basic")
- All 8 mini-games, full app/site blocking, streaks & points, Edge access, ad-supported

**Partner — $8.00/mo** (was "Pro")
- Everything in New Leaf + accountability partner notifications, weekly insights, ad-free

Old Pro tier ($4.22/mo, $39.99/yr) is eliminated. All game content in New Leaf.

**Launch promo:** All users get free Pro (New Leaf) access until 2026-09-01.

### The Edge — Transactional Bypass (v2, not built yet)

Subscribers can pay a randomly-selected amount to bypass the gate instead of playing. Two modes:
- **Kick Back** — 70% donated to charity, 30% NoGoon. Pool: $0.50-$3.00
- **Raw** — 100% to NoGoon. Pool: $2.99-$9.99

Odd amounts ($0.77, $5.01, $6.17) feel like something that happened TO you, not a price you chose.

### Point Packs (one-time consumables)
- 500 points — $0.99
- 1,500 points — $1.99
- 5,000 points — $4.99

### RevenueCat Product IDs
`nogoon_basic_monthly`, `nogoon_pro_monthly`, `nogoon_pro_yearly`, `nogoon_partner`, `nogoon_points_500`, `nogoon_points_1500`, `nogoon_points_5000`

---

## CODEBASE MAP

### Repo structure (GitHub: `88eightsss/nogoon`, branch: `master`)

```
app/
  (tabs)/index.tsx    — Home screen (main dashboard)
  gate.tsx            — Gate interception screen (mini-game launcher)
  setup-guide.tsx     — Onboarding / accessibility service setup
  _layout.tsx         — Root layout with error boundary

lib/
  purchases.ts        — RevenueCat config, product IDs, purchase logic

stores/
  useSubscriptionStore.ts  — Zustand store for subscription state
  useUserStore.ts          — Zustand store for user profile/streaks/points

types/
  purchases.ts        — TypeScript types for purchase system

supabase/
  functions/
    notify-partner/index.ts  — Edge Function for partner email notifications (NOT deployed — needs Resend domain)

legal/
  delete-account.html   — Account deletion page (hosted on GitHub Pages)
  privacy-policy.html   — Privacy policy (hosted on GitHub Pages)

android/
  (Kotlin Accessibility Service for gate interception)
```

### Key commits
- `da7ab32` — RevenueCat production key committed
- `0bd92f2` — Bumped versionCode to 2
- `f5b5740` — Removed `withAppBlocker` plugin (fixed BIND_ACCESSIBILITY_SERVICE)
- `4c85547` — Old commit from ~2 weeks ago (stale)

### Supabase schema (profiles table)
```sql
profiles (
  id uuid PRIMARY KEY,          -- matches auth.uid()
  walk_away_count integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  total_points integer DEFAULT 0,
  partner_email text,
  partner_name text,
  updated_at timestamptz DEFAULT now()
)
-- RLS enabled: users can only read/update/insert their own row
```

### EAS config (`eas.json`)
```json
{
  "cli": { "version": ">= 3.0.0" },
  "build": {
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "android": { "buildType": "app-bundle" } }
  }
}
```

### App config highlights (`app.json`)
- Package: `com.nogoon.app`
- Android versionCode: `2`
- Edge-to-edge enabled, predictive back gesture disabled
- Adaptive icon with `#08080e` background

---

## WHAT'S BEEN DONE (all sessions combined)

### Session 1 (2026-05-14)
- Full codebase audit (security, types, error boundary, memoization)
- Created patched files in project folder
- Wrote legal pages (privacy policy, delete account)
- Created play-store-listing.md and play-store-assets
- Set up QUICK-COMMANDS.md for manual Supabase/deploy steps
- Wrote tester-setup-guide.md

### Session 2 (2026-05-23)
- Finalized monetization plan (New Leaf / Partner / The Edge)
- Updated purchases.ts and useSubscriptionStore.ts with new tier structure
- Got RevenueCat production key and committed it

### Session 3 (2026-06-04 to 2026-06-05)
- Fixed Supabase profiles table (added missing columns)
- Completed all Play Console declarations (data safety, app access, financial features, government apps, health apps, advertising ID)
- Set app category and contact details
- Completed store listing (descriptions, screenshots, feature graphic, icon)
- Removed withAppBlocker plugin (BIND_ACCESSIBILITY_SERVICE fix)
- Rebuilt production .aab
- Set up closed testing track
- Resend cleanup (domain removed, partner email disabled in code)

### Session 4 (2026-06-06 to 2026-06-07)
- Bumped versionCode to 2, rebuilt .aab
- Uploaded .aab to closed testing, submitted for review
- Set up daily scheduled task to check beta approval
- Diagnosed rejection (Health & Fitness category + health declaration)
- Fixed category → Lifestyle, removed health declaration
- Resubmitted for review

---

## IMMEDIATE NEXT STEPS (priority order)

### 1. Monitor Google review
The daily scheduled task checks at 10 AM. Review takes up to 7 days. If rejected again, check the rejection email for the specific reason.

### 2. Recruit 12 testers
This is the biggest bottleneck. Jordan needs to send friends/family:
- Their Gmail address gets added to the closed beta tester list in Play Console
- Once the test is live, they get an opt-in link to join and install

A `tester-setup-guide.md` exists in the project folder — it walks testers through APK installation. For Play Store closed testing, the process is simpler (they just opt in via a link).

### 3. Wait 14-day closed testing period
Clock starts when the test goes live. Can't be shortened.

### 4. App improvements while waiting

**Deferred to v1.1 — Accountability Partner emails:**
- UI is built but email sending isn't wired up
- Needs: domain purchase → Resend setup → DNS verification → deploy Edge Function
- Full steps in LAUNCH-CHECKLIST.md under "Deferred to v1.1"

**Supabase free tier risk:**
- Projects pause after 7 days of inactivity
- Either upgrade to Pro ($25/mo) or ensure regular DB queries
- A paused backend = app is completely dead for users

**The Edge (v2):**
- Transactional bypass feature — designed but not built
- Should wait until after launch and core loop validation

### 5. Apply for production access
After 14 days + 12 testers → Dashboard → Apply for access to production

---

## FILES IN PROJECT FOLDER

```
C:\Users\jtshi\OneDrive\Documents\Claude\Projects\Nogoon 888 (2.0)\
├── LAUNCH-CHECKLIST.md          — Master checklist with all done/remaining items
├── NOGOON-3.0-HANDOFF.md        — This file
├── QUICK-COMMANDS.md            — Copy-paste commands for Supabase, EAS, etc.
├── play-store-listing.md        — Store listing text (NOTE: category outdated, now Lifestyle)
├── tester-setup-guide.md        — Guide for beta testers
├── nogoon_feature_1024x500.png  — Play Store feature graphic
├── nogoon_icon_512.png          — App icon (512x512)
├── app/                         — Patched app files (layout, gate, setup-guide)
├── lib/                         — purchases.ts (RevenueCat config)
├── stores/                      — Zustand stores (subscription, user)
├── types/                       — TypeScript types
├── supabase/                    — Edge Function (notify-partner)
├── legal/                       — Privacy policy + delete account HTML
├── patches/                     — Patch documentation from session 1
├── play-store-assets/           — Screenshots + feature graphic for store listing
```

---

## KNOWN ISSUES & GOTCHAS

1. **PowerShell doesn't support `&&`** — use `;` to chain commands
2. **`C:\Users\jtshi\nogoon` directory** — this is the local git clone. It existed from 2 weeks ago and caused a stale build once. Always `git pull` before building.
3. **Play Console direct URL navigation** — sometimes redirects to Home page. Click through the app list instead.
4. **Clipboard clears on graphics crash** — Jordan's GPU crashes occasionally, wiping clipboard. Just re-run clipboard writes.
5. **Terminal is "click" tier** — you can click Run buttons but CANNOT type. Use bash tool for shell commands, clipboard for giving Jordan commands to paste.
6. **Supabase auth** — uses GitHub OAuth for dashboard sign-in
7. **RevenueCat production key is committed** — it's in `lib/purchases.ts` (commit `da7ab32`). The test key was `test_cAEXmoziVycrJWMJaJDHdwPleDy`.
8. **`play-store-listing.md` says "Health & Fitness"** — the actual Play Console category is now **Lifestyle**. Update the file.

---

## SCHEDULED TASKS

- **`check-nogoon-beta-approval`** — Daily at 10 AM, checks Play Console for beta approval status. Located at `C:\Users\jtshi\OneDrive\Documents\Claude\Scheduled\check-nogoon-beta-approval\SKILL.md`

---

## FOR THE NEW SESSION

Start by:
1. Reading this doc (you're doing that now)
2. Checking if the Google review has been approved (look at Play Console or ask Jordan)
3. If approved: help recruit testers, draft messages, set up opt-in flow
4. If still pending: work on app improvements (fix the play-store-listing.md category, consider v1.1 features)
5. If rejected again: diagnose the new rejection reason from the email

Remember: Jordan says "yes" and expects you to go. Don't ask what to do — tell him what you're doing and do it.
