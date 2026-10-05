# NoGoon TODO

## Phantom features (built, but unreachable or half-wired) — on hold
- Accountability partner: code + `notify-partner` function exist, no entry point in the UI.
- Dead Reckoning, Ad Wall, Paywall screens: no route/entry leads to them.
- Cold Turkey, `blockSchedule`, `gameDuration`, `intentionGoal`, `dailyWalkAwayGoal`: state exists, no UI.
- `triggerCounts` recorded but never displayed.
- `checkResetStruggling` never called.
- "AI suggestions coming soon" teaser.

## Smaller items
- Calm tab nightly rule shows "Set 0m ago" right after saving.
- Calm Waiting Room exit lands on Today.
- Reset-password has no "resend code".
- Insights/Journal route isn't gated by the tutorial CTA.
- MILESTONES/start-date not fully account-scoped.
- Unlock minutes differ (post-game 20 vs override 10).
- Gate calm screen may clip on small phones.
- User store has no `version`/`migrate`.
- Me tab has 8+ controls; consider grouping.
- `AdInterstitial` only unsubscribes the first ad's listeners.

## Still open from the 2026-10-05 audit (lower risk)
- Native: unlock is keyed to the exact host (m./music./web. subdomains re-gate); `lastSeenUrl` stamped before the cooldown check; text-scan URL fallback can match on-page text; VPN DNS forwarding is serial with a 3s timeout; overnight Mode windows use the current day-of-week; widget lags up to 30 min.
- Cloud: `loadFromSupabase` doesn't pull partner info, journal entries or freeze tokens back; one freeze token covers a gap of any length.
- A kill during onboarding after adding sites marks the user onboarded (skips setup steps).
- Dev toggle "Unlock everything now" is exposed in Me; remove before production.
- AdMob uses Google test IDs / REPLACE_ME ad units.
- Arcade `?game=` deep link bypasses the fullArcade lock (intentional for Daily Challenge — confirm).

## Deploy checklist (yours to run)
- `supabase functions deploy delete-account notify-partner positive-news`
- Run `supabase/migrations/20261005_baseline_tables_and_rls.sql` (safe on existing tables; adds columns + own-row RLS).
- Run `supabase/migrations/20261005_profile_blocked_apps.sql` in the Supabase SQL editor.
- Supabase → Authentication → Email Templates → Reset Password: include `{{ .Token }}` so the email shows the 6-digit code.
- Play Console: add a web account-deletion URL (Data safety → Data deletion).
- New EAS build for the native (Kotlin) changes.
