// Parts of the app that are built but not fully switched on yet. While a flag is true, the
// screen shows caution tape and an "Under construction" sign so nobody expects it to be finished.
// Flip a flag to false the day that part is really live.
export const UNDER_CONSTRUCTION = {
  /** The Wall (sponsor board): the backend is not deployed and there are no sold tiles yet. */
  wall: true,
  /** Happening near you: live. A weekly feed (events-draft) reads local news and organiser pages. */
  events: false,
  /** Good news in the Briefing: the daily feed backend is live (feed-daily returned stored 10, wiki 6 on 2026-10-21). */
  goodNews: false,
} as const;
