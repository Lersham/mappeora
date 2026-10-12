import { afterEach, describe, expect, it, vi } from 'vitest';
import { installWebBack } from './backButton';

afterEach(() => vi.restoreAllMocks());

describe('installWebBack', () => {
  it('after a reload with the map open, takes its page back only once the page has loaded', () => {
    // The reloaded page still has the app's page on top, and no map is open.
    vi.spyOn(history, 'state', 'get').mockReturnValue({ 'mappeora-back': true });
    const readyState = vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
    const back = vi.spyOn(history, 'back').mockImplementation(() => {});
    const undo = installWebBack(
      () => {},
      () => false,
      () => () => {},
    );
    // Safari would stop loading the page: no `load` event, images dropped.
    expect(back).not.toHaveBeenCalled();
    readyState.mockReturnValue('complete');
    window.dispatchEvent(new Event('load'));
    expect(back).toHaveBeenCalledTimes(1);
    undo();
  });
});
