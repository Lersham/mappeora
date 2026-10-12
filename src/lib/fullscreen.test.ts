import { afterEach, describe, expect, it, vi } from 'vitest';
import { canFullscreen, isFullscreen, toggleFullscreen } from './fullscreen';

const stubDocument = (doc: Record<string, unknown>) => vi.stubGlobal('document', { documentElement: {}, ...doc });
afterEach(() => vi.unstubAllGlobals());

describe('fullscreen', () => {
  it('is available with the standard or the webkit API, not without', () => {
    stubDocument({});
    expect(canFullscreen()).toBe(false);
    stubDocument({ fullscreenEnabled: true });
    expect(canFullscreen()).toBe(true);
    stubDocument({ webkitFullscreenEnabled: true });
    expect(canFullscreen()).toBe(true);
  });

  it('enters with the webkit fallback and leaves when already in', async () => {
    const enter = vi.fn();
    stubDocument({ documentElement: { webkitRequestFullscreen: enter } });
    await toggleFullscreen();
    expect(enter).toHaveBeenCalledTimes(1);

    const exit = vi.fn();
    stubDocument({ webkitFullscreenElement: {}, webkitExitFullscreen: exit });
    expect(isFullscreen()).toBe(true);
    await toggleFullscreen();
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('swallows a refusal', async () => {
    stubDocument({ documentElement: { requestFullscreen: () => Promise.reject(new Error('no gesture')) } });
    await expect(toggleFullscreen()).resolves.toBeUndefined();
  });
});
