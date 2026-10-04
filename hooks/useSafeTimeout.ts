// ─── useSafeTimeout ──────────────────────────────────────────────────────────
//
// Drop-in replacement for setTimeout inside a component. Every timer it
// schedules is cancelled automatically when the component unmounts, so a
// delayed callback (e.g. a game's "finish in 700ms" → onComplete) can't fire
// after the player has already left the screen and act on a dead game.

import { useCallback, useEffect, useRef } from 'react';

export function useSafeTimeout() {
  const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  return useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
    return id;
  }, []);
}
