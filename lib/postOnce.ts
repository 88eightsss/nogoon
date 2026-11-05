// ─── Post once: one event, every place it needs to be ──────────────────────────────────────────
//
// The host fills in ONE short form. This file turns it into the words for each place (Facebook, Instagram,
// X, a neighborhood group, a bulletin or church newsletter). Step 1 of the plan: no platform accounts, no
// posting for anyone. The host copies or shares each piece to their own account.
//
// Locked facts: the title, when, area, cost and link are the host's, and every caption below carries them
// word for word. Nothing here rewrites a fact. When the AI step arrives it may only change the other words,
// and `lockedFactsPresent()` is the check that every locked fact still appears unchanged in what it wrote.

export type PostKind = 'hand' | 'happening';
export type PostMode = 'once' | 'weekly';

export interface PostOnceEvent {
  id: string;
  title: string;
  host: string;
  kind: PostKind;
  mode: PostMode;
  /** One-time: free text such as "Sat Nov 7, 9:00 am to 12:00 pm". */
  when: string;
  /** Weekly: 0 = Sunday .. 6 = Saturday, and a time such as "9:00 am to 12:00 pm". */
  weekday: number;
  time: string;
  /** Coarse area only. Never a home address. */
  area: string;
  cost: string;
  /** What is needed in words ("6 hands needed"). Never a count of people going. */
  ask: string;
  /** The smallest way in ("Come for the first hour"). */
  smallest: string;
  details: string;
  /** The host's own https link (sign-up or info). Used for the QR code and in captions. */
  link: string;
  createdAt: number;
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function blankEvent(): PostOnceEvent {
  return {
    id: String(Date.now()), title: '', host: '', kind: 'happening', mode: 'once', when: '', weekday: 6, time: '',
    area: '', cost: 'Free', ask: '', smallest: '', details: '', link: '', createdAt: Date.now(),
  };
}

export function whenText(e: PostOnceEvent): string {
  if (e.mode === 'weekly') return `Every ${DAYS[e.weekday]}${e.time.trim() ? `, ${e.time.trim()}` : ''}`;
  return e.when.trim();
}

/** Same rules the database applies to links (see url_ok in the migrations): https only, no bare IPs, no shorteners. */
export function urlOk(u: string): boolean {
  if (!u || u.length > 500) return false;
  if (!/^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]+)?(\/|\?|#|$)/i.test(u)) return false;
  if (/^https:\/\/[0-9.]+(:[0-9]+)?(\/|\?|#|$)/i.test(u)) return false;
  if (/^https:\/\/([a-z0-9-]+\.)*(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|t\.ly|lnkd\.in)(:[0-9]+)?(\/|\?|#|$)/i.test(u)) return false;
  return true;
}

/** Problems to fix before the kit is made. Empty list means good to go. */
export function problems(e: PostOnceEvent): string[] {
  const out: string[] = [];
  if (e.title.trim().length < 3) out.push('Give it a short title.');
  if (e.host.trim().length < 2) out.push('Say who is hosting.');
  if (!whenText(e)) out.push(e.mode === 'weekly' ? 'Add the time.' : 'Say when it is.');
  if (e.area.trim().length < 2) out.push('Add the area, like a town. Not a home address.');
  if (e.link.trim() && !urlOk(e.link.trim())) out.push('The link needs to start with https:// and be a real web address (no short links).');
  return out;
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function factsLine(e: PostOnceEvent): string {
  return [whenText(e), clean(e.area), clean(e.cost)].filter(Boolean).join(' · ');
}

export function captionFacebook(e: PostOnceEvent): string {
  const lines = [
    clean(e.title),
    factsLine(e),
    e.ask.trim() ? `${clean(e.ask)}.` : '',
    e.smallest.trim() ? `Smallest way in: ${clean(e.smallest)}.` : '',
    e.details.trim(),
    e.link.trim() ? `Details: ${e.link.trim()}` : '',
    `Hosted by ${clean(e.host)}.`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function captionInstagram(e: PostOnceEvent): string {
  const lines = [
    clean(e.title),
    factsLine(e),
    e.ask.trim() ? `${clean(e.ask)}.` : '',
    e.smallest.trim() ? `Smallest way in: ${clean(e.smallest)}.` : '',
    e.details.trim(),
    e.link.trim() ? `Link: ${e.link.trim()} (Instagram does not make links in captions tappable, so put it in your bio too.)` : '',
    `Hosted by ${clean(e.host)}.`,
  ];
  return lines.filter(Boolean).join('\n');
}

/** X counts every link as 23 characters, whatever its length. */
export const X_LIMIT = 280;
export function xLength(text: string): number {
  return text.replace(/https:\/\/\S+/g, 'x'.repeat(23)).length;
}
export function captionX(e: PostOnceEvent): string {
  const base = [clean(e.title), factsLine(e)];
  const tail = [e.link.trim(), `Hosted by ${clean(e.host)}.`].filter(Boolean);
  // Add the optional lines one at a time and keep only what fits.
  let text = [...base, ...tail].join('\n');
  for (const extra of [e.ask.trim() ? `${clean(e.ask)}.` : '', e.smallest.trim() ? `Smallest way in: ${clean(e.smallest)}.` : '']) {
    if (!extra) continue;
    const next = [...base, extra, ...tail].join('\n');
    if (xLength(next) <= X_LIMIT) { base.push(extra); text = next; }
  }
  return text;
}

export function captionNeighbors(e: PostOnceEvent): string {
  const lines = [
    `${clean(e.title)} (${clean(e.host)})`,
    factsLine(e),
    e.ask.trim() ? `${clean(e.ask)}.` : '',
    e.smallest.trim() ? `Smallest way in: ${clean(e.smallest)}.` : '',
    e.details.trim(),
    e.link.trim() ? `More: ${e.link.trim()}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

/** Plain text for a bulletin board, church newsletter or an email. No link formatting. */
export function captionBulletin(e: PostOnceEvent): string {
  const lines = [
    clean(e.title),
    `When: ${whenText(e)}`,
    `Where: ${clean(e.area)}`,
    `Cost: ${clean(e.cost) || 'Free'}`,
    e.ask.trim() ? `Needed: ${clean(e.ask)}` : '',
    e.smallest.trim() ? `Smallest way in: ${clean(e.smallest)}` : '',
    e.details.trim(),
    e.link.trim() ? `More: ${e.link.trim()}` : '',
    `Hosted by ${clean(e.host)}`,
  ];
  return lines.filter(Boolean).join('\n');
}

export const OUTPUTS = [
  { key: 'facebook', label: 'Facebook', make: captionFacebook },
  { key: 'instagram', label: 'Instagram', make: captionInstagram },
  { key: 'x', label: 'X', make: captionX },
  { key: 'neighbors', label: 'Neighborhood group', make: captionNeighbors },
  { key: 'bulletin', label: 'Bulletin or email', make: captionBulletin },
] as const;

/** Every locked fact the host typed must still be in a caption, word for word. Used by the AI step later. */
export function lockedFacts(e: PostOnceEvent): string[] {
  return [clean(e.title), whenText(e), clean(e.area), clean(e.cost), e.link.trim()].filter(Boolean);
}
export function lockedFactsPresent(e: PostOnceEvent, text: string): { ok: boolean; missing: string[] } {
  const flat = clean(text);
  const missing = lockedFacts(e).filter((f) => !flat.includes(f));
  return { ok: missing.length === 0, missing };
}
