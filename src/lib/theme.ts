import { useSyncExternalStore } from 'react';
import { DEFAULT_FONT, FONT_IDS, type Font } from './fonts';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'fintracker_theme';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

// The <html data-theme> attribute is the single source of truth (set before
// paint by a script in the root layout), so every client component can follow it.
export function useTheme(): Theme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'),
    () => 'dark'
  );
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* storage blocked — the choice just won't persist */
  }
}

const FONT_KEY = 'fintracker_font';

function subscribeFont(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-font'] });
  return () => observer.disconnect();
}

export function useFont(): Font {
  return useSyncExternalStore(
    subscribeFont,
    () => {
      const f = document.documentElement.getAttribute('data-font') ?? '';
      return (FONT_IDS.includes(f) ? f : DEFAULT_FONT) as Font;
    },
    () => DEFAULT_FONT
  );
}

export function setFont(font: Font) {
  document.documentElement.setAttribute('data-font', font);
  try {
    localStorage.setItem(FONT_KEY, font);
  } catch {
    /* storage blocked — the choice just won't persist */
  }
}
