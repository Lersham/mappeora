import { describe, expect, it } from 'vitest';
import { backupDue } from './backup';

const DAY = 24 * 60 * 60 * 1000;
const now = 100 * DAY;
const maps = (n: number, updatedAt = now) => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, title: `Mappa ${i}`, updatedAt }));

describe('backupDue', () => {
  it('asks for a first copy once there are a few maps, or one is a week old', () => {
    expect(backupDue([], now, {})).toBe(false);
    expect(backupDue(maps(2), now, {})).toBe(false);
    expect(backupDue(maps(3), now, {})).toBe(true);
    expect(backupDue(maps(1, now - 8 * DAY), now, {})).toBe(true);
  });

  it('asks again two weeks after the last copy, only if something changed', () => {
    const savedAt = now - 15 * DAY;
    expect(backupDue(maps(5, savedAt - DAY), now, { savedAt })).toBe(false);
    expect(backupDue(maps(5, now - DAY), now, { savedAt })).toBe(true);
    expect(backupDue(maps(5, now - DAY), now, { savedAt: now - 3 * DAY })).toBe(false);
  });

  it('keeps quiet after «Più tardi»', () => {
    expect(backupDue(maps(5), now, { snoozedUntil: now + DAY })).toBe(false);
  });
});
