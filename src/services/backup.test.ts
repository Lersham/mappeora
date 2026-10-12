import { describe, expect, it, vi } from 'vitest';
import { backupDue, saveAllMaps, skippedNote } from './backup';

const shared = vi.fn(async () => {});
vi.mock('./export', () => ({ shareFile: (...args: unknown[]) => (shared as (...a: unknown[]) => unknown)(...args) }));
vi.mock('./storage', () => ({
  storage: () => ({
    list: async () => ['ok', 'rotta', 'ok2'].map((id) => ({ id, title: id, updatedAt: 1 })),
    get: async (id: string) => {
      if (id === 'rotta') throw new Error('damaged');
      return { id, title: id, nodes: [], edges: [], createdAt: 1, updatedAt: 1 };
    },
  }),
}));

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

describe('skippedNote', () => {
  it('says nothing when all maps were saved', () => {
    expect(skippedNote(0)).toBe('');
  });

  it('tells how many maps were left out, singular and plural', () => {
    expect(skippedNote(1)).toBe(' 1 mappa non si riesce più a leggere ed è rimasta fuori dalla copia.');
    expect(skippedNote(3)).toBe(' 3 mappe non si riescono più a leggere e sono rimaste fuori dalla copia.');
  });
});

describe('saveAllMaps', () => {
  it('saves the readable maps and counts the damaged one it left out', async () => {
    expect(await saveAllMaps()).toEqual({ saved: 2, skipped: 1 });
    expect(shared).toHaveBeenCalledTimes(1);
  });
});
