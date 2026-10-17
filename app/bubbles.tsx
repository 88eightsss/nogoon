// ─── Brain Bubbles ─────────────────────────────────────────────────────────────
// Brain Bubbles now lives inside the Journal space (Canvas tab). This route stays so older
// links and offers ("Empty your head") still land in the right place.

import { Redirect } from 'expo-router';

export default function BubblesRoute() {
  return <Redirect href={{ pathname: '/journal', params: { tab: 'canvas' } } as any} />;
}
