import { defineStore } from 'pinia';

export type ThemePref = 'system' | 'light' | 'dark';

const THEME_KEY = 'grocery:theme';

function readStoredTheme(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* ignore */
  }
  return 'system';
}

export const useAppStore = defineStore('app', {
  state: () => ({
    theme: readStoredTheme() as ThemePref,
  }),
  actions: {
    setTheme(pref: ThemePref) {
      this.theme = pref;
      try {
        localStorage.setItem(THEME_KEY, pref);
      } catch {
        /* ignore */
      }
      this.applyTheme();
    },
    applyTheme() {
      const root = document.documentElement;
      if (this.theme === 'system') root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', this.theme);
    },
  },
});
