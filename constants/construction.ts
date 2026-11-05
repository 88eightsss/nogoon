// Parts of the app that are built but not fully switched on yet. While a flag is true, the
// screen shows caution tape and an "Under construction" sign so nobody expects it to be finished.
// Flip a flag to false the day that part is really live.
export const UNDER_CONSTRUCTION = {
  /** The Wall (sponsor board): the backend is not deployed and there are no sold tiles yet. */
  wall: true,
  /** Step Out feed, doors, crews and postcards: sample items and local-only replies. No hosts, no backend yet. Hidden from the Step Out tab until Show me everything is on. */
  stepOutFeed: true,
  /** Post once (host tool): saves posts on the phone only and makes the words and a QR flyer to share. Does not post for anyone. Reached from the Step Out feed, which is itself hidden until Show me everything is on. */
  postOnce: true,
  /** Happening near you: live. A weekly feed (events-draft) reads local news and organiser pages. */
  events: false,
  /** Good news in the Briefing: the daily feed backend is live (feed-daily returned stored 10, wiki 6 on 2026-10-21). */
  goodNews: false,
} as const;
