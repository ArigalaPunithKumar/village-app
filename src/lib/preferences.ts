export type Theme = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'medium' | 'large' | 'extra-large';
export interface Preferences {
  theme: Theme;
  fontSize: FontSize;
  language: 'en' | 'te';
  notifications: Record<string, boolean>;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  fontSize: 'medium',
  language: 'en',
  notifications: { complaints: true, announcements: true, emergency: true, polls: true },
};

export function readPreferences(): Preferences {
  try { return { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem('palle_preferences') || '{}') }; }
  catch { return DEFAULT_PREFERENCES; }
}

export function applyPreferences(preferences: Preferences) {
  const dark = preferences.theme === 'dark' || (preferences.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('theme-dark', dark);
  document.documentElement.style.fontSize = ({ small: '14px', medium: '16px', large: '18px', 'extra-large': '20px' })[preferences.fontSize];
  document.documentElement.lang = preferences.language === 'te' ? 'te' : 'en';
}

export function applyStoredPreferences() {
  applyPreferences(readPreferences());
}
