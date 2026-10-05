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

## Deploy checklist (yours to run)
- `supabase functions deploy delete-account`
- Run `supabase/migrations/20261005_profile_blocked_apps.sql` in the Supabase SQL editor.
- Supabase → Authentication → Email Templates → Reset Password: include `{{ .Token }}` so the email shows the 6-digit code.
- Play Console: add a web account-deletion URL (Data safety → Data deletion).
- New EAS build for the native (Kotlin) changes.
