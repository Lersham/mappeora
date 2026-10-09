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
  wideSpacing: true,
  theme: 'crema',
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
    { name: 'mappeora-settings', version: 1 },
  ),
);
