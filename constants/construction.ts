// Parts of the app that are built but not fully switched on yet. While a flag is true, the
// screen shows caution tape and an "Under construction" sign so nobody expects it to be finished.
// Flip a flag to false the day that part is really live.
export const UNDER_CONSTRUCTION = {
  /** The Wall (sponsor board): the backend is not deployed and there are no sold tiles yet. */
  wall: true,
  /** Happening near you: the community events list is still being filled in by hand. */
  events: true,
  /** Good news in the Briefing: shows sample stories until the daily feed backend is deployed. */
  goodNews: true,
} as const;
