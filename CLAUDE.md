# NoGoon — house rules for Claude

NoGoon is an Android app that intercepts blocked apps and sites, shows a short pause (game, breath, walk away),
and replaces the endless feed with a calm, finite daily Briefing, a Journal and The Wall (sponsor tiles).
Owner: Jordan (GitHub 88eightsss). Package `com.nogoon.app`. Play Store: closed testing.

## Stack
- Expo SDK 54, React Native 0.81, React 19, TypeScript, expo-router, Zustand
- Supabase (project `hadcagughbyouagwpdhq`): auth, Postgres, edge functions in `supabase/functions`
- RevenueCat (`react-native-purchases`), Google Play Billing for Wall supporter tiles
- Native Android: Kotlin Accessibility Service + VPN code in `android-src/` and `plugins/` (config plugins).
  `android/` is generated and git-ignored.
- EAS Build, project `80b5ee13-4dfd-462d-8bc3-51d022cd3e51`. Versions are local: bump `android.versionCode` in `app.json`.

## Rules (CI and review enforce these)
1. No emojis anywhere in UI text. Use icons (`components/ui/Glyph.tsx` maps old emoji keys to icons).
2. Anything a user would miss after reinstalling (streaks, walk-aways, achievements, journal) must sync to Supabase, not live only in AsyncStorage.
3. Every new Supabase table gets row-level security in the same migration.
4. Edge function JWT settings must match `scripts/deploy-backend.ps1` and the NO_JWT list in `.github/workflows/deploy-functions.yml`. Webhooks and cron functions use `--no-verify-jwt` and check their own secret.
5. Never commit keys. Secrets live in GitHub Secrets, EAS credentials or Supabase secrets.
6. Do not change Accessibility Service or VPN behaviour, permissions in `app.json`, or anything Play policy-sensitive without labelling the PR `needs-decision`.
7. Migrations in `supabase/migrations` are applied by Jordan by hand. Write them; never run them.
8. The Wall never shows ads for adult content, gambling, dating, alcohol, crypto, or social/short-video apps, and never appears inside the gate.
9. Keep the feel: calm, finite, no infinite scroll, no ad banners after games.

## Before opening a PR
- `npx tsc --noEmit` passes
- Small, single-purpose PRs with a plain-English title; label `feature`, `fix` or `polish`
- If an issue needs a product decision, comment on it and add `needs-decision` instead of guessing

## Commands (Jordan uses Windows PowerShell; chain with `;`, start with `cd C:\Users\jtshi\nogoon`)
- Type-check: `npx tsc --noEmit`
- Release: bump versionCode in app.json, merge, then `git tag v1.x.y; git push origin v1.x.y`
