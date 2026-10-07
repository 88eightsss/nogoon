// ─── Accessibility prominent disclosure ──────────────────────────────────────
//
// Google Play requires apps that use the AccessibilityService API (and are not
// accessibility tools) to show an in-app disclosure BEFORE sending the user to
// Android's Accessibility settings, and to get explicit consent first.
//
// Any code that wants to open those settings calls `request(onAccept)`. The
// single <AccessibilityDisclosure /> host mounted in app/_layout.tsx shows the
// disclosure; `onAccept` only runs if the user taps "Agree and continue".
// Not persisted: the disclosure is shown every time the user is about to enable.

import { create } from 'zustand';

interface DisclosureState {
  visible: boolean;
  pending: (() => void) | null;
  request: (onAccept: () => void) => void;
  accept: () => void;
  decline: () => void;
}

export const useDisclosureStore = create<DisclosureState>((set, get) => ({
  visible: false,
  pending: null,
  request: (onAccept) => set({ visible: true, pending: onAccept }),
  accept: () => {
    const fn = get().pending;
    set({ visible: false, pending: null });
    fn?.();
  },
  decline: () => set({ visible: false, pending: null }),
}));
