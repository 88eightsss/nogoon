# NoGoon TODO

## Phantom features (built, but unreachable or half-wired) — on hold
- Accountability partner: code + `notify-partner` function exist, no entry point in the UI.
- Ad Wall, Paywall screens: no route/entry leads to them.
- `blockSchedule` (Modes + Curfew already cover schedules), `gameDuration`, `intentionGoal`, `dailyWalkAwayGoal`: state exists, no UI.
- `triggerCounts` duplicates `reflectionCounts` (already shown in Insights).
- `checkResetStruggling` never called.
- "AI suggestions coming soon" teaser.

## Done in v29 (build 29)
- Unlocks cover the whole site (host + subdomains) and last 20 min on every path.
- Fresh installs always run the full onboarding/palette intro; the cloud no longer marks a user onboarded.
- Home snapshot shows real numbers; Me tab shows version + build; user store has `version`/`migrate`.
- Play-required Accessibility prominent disclosure + consent screen before any Enable/Fix button opens Android settings (`components/AccessibilityDisclosure.tsx`, `stores/useDisclosureStore.ts`, wired in `hooks/useAppBlocker.ts`). Re-record the Play prominent-disclosure video to show it.
- Onboarding "Enable app blocking" button gently breathes (components/Breathe.tsx) to draw the eye on a text-heavy screen; respects reduce-motion.
- Calm "Set just now" label, waiting-room exit returns to Calm, reset-password resend, gate calm screen scrolls on small phones.

- Progressive unlocks are OFF (`PROGRESSIVE_UNLOCKS = false` in stores/useProgressStore.ts): all features open from day one; the dev unlock toggle is hidden.
- Cold Turkey toggle in Me (48h wait + typed phrase to turn off); Dead Reckoning reachable from the Calm tab.
- "What now?" button uses the theme accent instead of the companion stage color (was red on some stages).

## Smaller items
- Insights/Journal route isn't gated by the tutorial CTA.
- MILESTONES/start-date not fully account-scoped.
- Me tab has 8+ controls; consider grouping.
- `AdInterstitial` only unsubscribes the first ad's listeners.

## Still open from the 2026-10-05 audit (lower risk)
- Native: `lastSeenUrl` stamped before the cooldown check; text-scan URL fallback can match on-page text; VPN DNS forwarding is serial with a 3s timeout; overnight Mode windows use the current day-of-week; widget lags up to 30 min.
- Cloud: `loadFromSupabase` doesn't pull partner info, journal entries or freeze tokens back; one freeze token covers a gap of any length.
- AdMob uses Google test IDs / REPLACE_ME ad units.
- Arcade `?game=` deep link bypasses the fullArcade lock (intentional for Daily Challenge — confirm).

## Deploy checklist (yours to run)
- `supabase functions deploy delete-account notify-partner positive-news`
- Run `supabase/migrations/20261005_profile_blocked_apps.sql` in the Supabase SQL editor.
- Supabase → Authentication → Email Templates → Reset Password: include `{{ .Token }}` so the email shows the 6-digit code.
- Play Console: add a web account-deletion URL (Data safety → Data deletion).
- New EAS build for the native (Kotlin) changes.
- Dev toggle "Unlock everything now" is exposed in Me; keeping for first testing builds, hide/remove before wide production release.

## Network Shield (VPN) — removed from the first release, kept for later
First Play release ships WITHOUT the VPN so the "VPN service" Play Console declaration is not required (it was overdue and blocks releases). `features.json` → `"networkShield": false` does all of this at once:
- `plugins/withAppBlocker.js` omits the `.NoGoonVpnService` manifest entry (and `BIND_VPN_SERVICE`) and does not copy `NoGoonVpnService.kt` / `DnsPacketParser.kt` into the build; it copies the no-op `android-src/vpn-stub/VpnController.kt` instead. The APK contains no VpnService code.
- JS: `constants/features.ts` (`NETWORK_SHIELD_ENABLED`) hides the Network filter row (onboarding), Network Shield card + recent-blocks log (Coverage), and VPN mentions in tutorial/tips/privacy/Me.
- Coverage lost without it: DNS-level blocking of sites/apps in contexts the Accessibility Service can't read (some in-app browsers/webviews, background requests). The Accessibility gate, notification filter and curfew/Hard Mode are unaffected.
- All VPN code is still in the repo: `android-src/NoGoonVpnService.kt`, `android-src/DnsPacketParser.kt`, `android-src/vpn/VpnController.kt`, `hooks/useVpn.ts`.

### Re-enable Network Shield (a later release)
1. Set `"networkShield": true` in `features.json`.
2. Rebuild with EAS (it re-runs prebuild; delete any local `android/` folder first so stale files don't linger).
3. In Play Console, complete the "VPN service" declaration (App content) for that release: core functionality = on-device DNS filtering for the user's blocklist; no traffic is logged or transmitted. Update privacy policy/Terms and Data safety wording if needed (VPN text is already in `app/privacy.tsx` behind the flag).
