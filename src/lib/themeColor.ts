import type { ThemeChoice } from '../store/settingsStore';

/**
 * The page colour of each background (--surface in styles/theme.css), also the
 * colour of the browser's bar. The same values are in public/theme-init.js,
 * which paints them before React starts: change both together.
 */
export const THEME_COLOR: Record<ThemeChoice, string> = {
  crema: '#fffdf7',
  bianco: '#ffffff',
  azzurro: '#f6fafe',
  scuro: '#282d38',
};
