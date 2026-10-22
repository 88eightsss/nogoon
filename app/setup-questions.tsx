// ─── Setup questions, again ───────────────────────────────────────────────────
// The onboarding "Make it yours" questions, opened from Me > Account & help >
// Setup & fixes. Only answered questions change anything, and nothing is removed
// or switched off, so existing settings are kept.

import { router } from 'expo-router';
import { SetupQuestions } from '@/components/onboarding/SetupQuestions';

export default function SetupQuestionsScreen() {
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as any));
  return <SetupQuestions rerun onFinish={close} onBack={close} />;
}
