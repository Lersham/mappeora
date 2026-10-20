/// <reference types="node" />
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { THEME_COLOR } from './themeColor';

// Vitest runs from the project's root. (A ?raw import of CSS comes back empty here.)
const css = readFileSync('src/styles/theme.css', 'utf8');

describe('THEME_COLOR', () => {
  it('has a colour for every background, as a hex code', () => {
    expect(Object.keys(THEME_COLOR).sort()).toEqual(['azzurro', 'bianco', 'crema', 'scuro']);
    for (const color of Object.values(THEME_COLOR)) expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('is the page colour (--surface) of each background in the stylesheet', () => {
    // :root is the default (bianco); the others are [data-theme='…'] blocks.
    const surface = (selector: string) => new RegExp(`${selector}\\s*\\{[^}]*--surface:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1].toLowerCase();
    expect(surface(':root')).toBe(THEME_COLOR.bianco);
    for (const theme of ['crema', 'azzurro', 'scuro'] as const) {
      expect(surface(`\\[data-theme='${theme}'\\]`)).toBe(THEME_COLOR[theme]);
    }
  });
});
