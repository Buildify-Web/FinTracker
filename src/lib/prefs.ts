import { useSyncExternalStore } from 'react';

// Small per-browser UI preferences (sidebar collapsed, hints on/off) kept in
// localStorage. useSyncExternalStore keeps every component in sync and renders
// the default on the server, so there's no hydration mismatch.
const EVENT = 'fintracker:prefs';

function read(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function usePref(key: string, fallback: string): [string, (value: string) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener('storage', cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener('storage', cb);
      };
    },
    () => read(key, fallback),
    () => fallback
  );
  const set = (next: string) => {
    try {
      localStorage.setItem(key, next);
    } catch {
      /* storage blocked — choice lasts until reload */
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return [value, set];
}
