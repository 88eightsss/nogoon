// ─── Feed Token Service ────────────────────────────────────────────────────────
//
// Core mechanic: tokens accumulate based on time since NoGoon was last opened.
// Opening the app CASHES OUT your earned tokens AND resets the accumulation timer.
//
// This means:
//   • Staying away longer = more tokens per check-in
//   • Checking the app constantly = earns almost nothing
//   • The reward is proportional to how well you stayed away
//
// 1 token per 30 minutes away, cap 8 tokens total.

import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY     = '@nogoon_feed_tokens';
const LAST_OPEN_KEY = '@nogoon_last_open_at';

export const MINS_PER_TOKEN = 30;
export const TOKEN_CAP      = 8;

// ── Token CRUD ────────────────────────────────────────────────────────────────

export async function getFeedTokens(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(TOKEN_KEY);
    return raw !== null ? Math.max(0, parseInt(raw, 10)) : 0;
  } catch {
    return 0;
  }
}

async function setFeedTokens(n: number): Promise<void> {
  try {
    await AsyncStorage.setItem(TOKEN_KEY, String(Math.min(Math.max(0, n), TOKEN_CAP)));
  } catch {}
}

/** Spend one token. Returns true if successful, false if out of tokens. */
export async function spendFeedToken(): Promise<boolean> {
  const current = await getFeedTokens();
  if (current <= 0) return false;
  await setFeedTokens(current - 1);
  return true;
}

/** Add tokens (respects cap). Returns new total. */
export async function addFeedTokens(n: number): Promise<number> {
  const current = await getFeedTokens();
  const next = Math.min(current + n, TOKEN_CAP);
  await setFeedTokens(next);
  return next;
}

// ── Time-away tracking ────────────────────────────────────────────────────────

/** Returns how many minutes have passed since the last app open. */
export async function getMinutesAway(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(LAST_OPEN_KEY);
    if (!raw) return 0;
    const minsAway = (Date.now() - parseInt(raw, 10)) / 60_000;
    return Math.max(0, minsAway);
  } catch {
    return 0;
  }
}

/** Returns how many tokens are pending (earned but not yet cashed out). */
export async function getPendingTokens(): Promise<number> {
  const minsAway = await getMinutesAway();
  const current  = await getFeedTokens();
  const canEarn  = TOKEN_CAP - current;
  return Math.min(Math.floor(minsAway / MINS_PER_TOKEN), canEarn);
}

/**
 * Call this EVERY time the app is opened / comes to foreground.
 *
 * It:
 *   1. Calculates time since last open
 *   2. Awards any earned tokens
 *   3. Resets the accumulation clock to NOW
 *
 * @param onTokensEarned  Optional callback — use to fire a local push notification.
 */
export async function processCheckIn(
  onTokensEarned?: (tokens: number, minutesAway: number) => void,
): Promise<void> {
  try {
    const now    = Date.now();
    const raw    = await AsyncStorage.getItem(LAST_OPEN_KEY);

    if (raw) {
      const lastOpen  = parseInt(raw, 10);
      const awayMs    = now - lastOpen;
      const awayMins  = awayMs / 60_000;

      // Sanity: ignore sub-1-minute opens or stale timestamps (>7 days)
      if (awayMins >= 1 && awayMins < 7 * 24 * 60) {
        const tokensEarned = Math.floor(awayMins / MINS_PER_TOKEN);
        if (tokensEarned > 0) {
          const before = await getFeedTokens();
          const after  = await addFeedTokens(tokensEarned);
          const actual = after - before;
          if (actual > 0) {
            onTokensEarned?.(actual, Math.round(awayMins));
          }
        }
      }
    }

    // Reset: stamp right now as the last open time
    await AsyncStorage.setItem(LAST_OPEN_KEY, String(now));
  } catch {}
}
