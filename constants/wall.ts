// The Wall: where companies buy tiles (the page in web/advertise). Leave empty until it is hosted;
// the "Advertise here" button stays hidden while this is blank.
export const ADVERTISE_URL = '';

// Supporter tiles: anyone signed in can buy ONE tile for a year and put a small picture on it (Google Play
// Billing through RevenueCat). Keep this false until all of these are done, in this order:
//   1. Play Console: in-app product `nogoon_wall_tile`, $2.50, and the app has been published with Billing.
//   2. RevenueCat: add that product (type: consumable) and set the webhook to supporter-webhook.
//   3. Supabase: migration 20261025 run; functions `supporter` and `supporter-webhook` deployed with their secrets.
//   4. The privacy policy and the Data Safety form mention uploaded pictures and the automatic safety check.
export const SUPPORTERS_ENABLED = false;
export const SUPPORTER_PRODUCT_ID = 'nogoon_wall_tile';
export const SUPPORTER_PRICE_FALLBACK = '$2.50';
export const SUPPORTER_MONTHS = 12;

export const WALL_CATEGORY_LABELS: Record<string, string> = {
  food_drink: 'Food and drink',
  local_business: 'Local business',
  health_wellness: 'Health and wellness',
  books_media: 'Books, music and film',
  education: 'Education',
  tech_tools: 'Tech and tools',
  art_craft: 'Art and craft',
  services: 'Services',
  nonprofit: 'Non-profit',
  other: 'Sponsor',
};
