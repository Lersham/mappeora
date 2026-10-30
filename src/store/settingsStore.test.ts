import { beforeEach, describe, expect, it } from 'vitest';
import { useSettings } from './settingsStore';

const save = (theme: string, version: number) =>
  localStorage.setItem('mappeora-settings', JSON.stringify({ state: { theme, font: 'atkinson' }, version }));

describe('settings saved on the device', () => {
  beforeEach(() => localStorage.clear());

  it('moves «crema», the background everyone started with before, to white, and keeps the rest', async () => {
    save('crema', 1);
    await useSettings.persist.rehydrate();
    expect(useSettings.getState()).toMatchObject({ theme: 'bianco', font: 'atkinson' });
    // Saved again as version 2: next time it is not moved.
    expect(JSON.parse(localStorage.getItem('mappeora-settings')!)).toMatchObject({ state: { theme: 'bianco' }, version: 2 });
  });

  it('keeps «crema» chosen since, and the other backgrounds', async () => {
    save('crema', 2);
    await useSettings.persist.rehydrate();
    expect(useSettings.getState().theme).toBe('crema');
    save('azzurro', 1);
    await useSettings.persist.rehydrate();
    expect(useSettings.getState().theme).toBe('azzurro');
  });
});
