import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FontChoice = 'lexend' | 'atkinson' | 'opendyslexic' | 'sistema';
export type ThemeChoice = 'crema' | 'bianco' | 'azzurro' | 'scuro';

/**
 * Accessibility preferences belong to the *user*, not to a map: a map
 * shared by a teacher is shown with the child's own font and colours.
 */
export interface Settings {
  font: FontChoice;
  /** Multiplier on the base font size. */
  textScale: number;
  uppercase: boolean;
  wideSpacing: boolean;
  theme: ThemeChoice;
  speechRate: number;
  voiceId?: string;
  highlightWords: boolean;
}

interface SettingsState extends Settings {
  update(patch: Partial<Settings>): void;
  reset(): void;
}

export const DEFAULT_SETTINGS: Settings = {
  font: 'lexend',
  textScale: 1.15,
  uppercase: false,
  wideSpacing: false,
  theme: 'bianco',
  speechRate: 0.9,
  voiceId: undefined,
  highlightWords: true,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(patch),
      reset: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'mappeora-settings',
      // 2: until October 2026 everyone started on «crema», most without choosing it.
      // They start on white now, like the sheet the map is printed on. (theme-init.js,
      // kept tiny, still paints that first launch crema until the app starts.)
      version: 2,
      migrate: (saved, version) => {
        const s = saved as SettingsState;
        return version < 2 && s.theme === 'crema' ? { ...s, theme: 'bianco' } : s;
      },
    },
  ),
);
