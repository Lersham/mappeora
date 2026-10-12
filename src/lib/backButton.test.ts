import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backIsHandled, handleBack, installWebBack, useBackHandler, watchBackHandlers } from './backButton';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** A dialog that takes the Back button while `active`. */
function Dialog({ onBack, active = true }: { onBack: () => void; active?: boolean }) {
  useBackHandler(onBack, active);
  return null;
}

const roots: Root[] = [];
function open(onBack: () => void, active = true) {
  const root = createRoot(document.createElement('div'));
  roots.push(root);
  act(() => root.render(createElement(Dialog, { onBack, active })));
  return {
    rerender: (next: () => void, nextActive = true) => act(() => root.render(createElement(Dialog, { onBack: next, active: nextActive }))),
    close: () => {
      roots.splice(roots.indexOf(root), 1);
      act(() => root.unmount());
    },
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount());
});

describe('Android Back button', () => {
  it('does nothing when no dialog is open', () => {
    expect(backIsHandled()).toBe(false);
    expect(handleBack()).toBe(false);
  });

  it('closes the newest dialog first', () => {
    const calls: string[] = [];
    open(() => calls.push('settings'));
    open(() => calls.push('colours'));
    expect(backIsHandled()).toBe(true);
    expect(handleBack()).toBe(true);
    expect(calls).toEqual(['colours']);
  });

  it('after the newest dialog closes, Back goes to the one under it', () => {
    const calls: string[] = [];
    open(() => calls.push('settings'));
    const colours = open(() => calls.push('colours'));
    colours.close();
    handleBack();
    expect(calls).toEqual(['settings']);
  });

  it('a dialog closed in the middle leaves the others in order', () => {
    const calls: string[] = [];
    open(() => calls.push('a'));
    const b = open(() => calls.push('b'));
    open(() => calls.push('c'));
    b.close();
    handleBack();
    expect(calls).toEqual(['c']);
  });

  it('an inactive handler does not take the Back button', () => {
    const onBack = vi.fn();
    open(onBack, false);
    expect(backIsHandled()).toBe(false);
    expect(handleBack()).toBe(false);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('takes and releases the Back button as `active` changes', () => {
    const onBack = vi.fn();
    const d = open(onBack, false);
    d.rerender(onBack, true);
    expect(backIsHandled()).toBe(true);
    d.rerender(onBack, false);
    expect(backIsHandled()).toBe(false);
  });

  it('calls the latest handler without opening the dialog again', () => {
    const first = vi.fn();
    const second = vi.fn();
    const watcher = vi.fn();
    const d = open(first);
    const unwatch = watchBackHandlers(watcher);
    d.rerender(second);
    handleBack();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(watcher).not.toHaveBeenCalled();
    unwatch();
  });

  it('tells watchers when a dialog opens or closes, until they stop watching', () => {
    const watcher = vi.fn();
    const unwatch = watchBackHandlers(watcher);
    const d = open(() => {});
    expect(watcher).toHaveBeenCalledTimes(1);
    d.close();
    expect(watcher).toHaveBeenCalledTimes(2);
    unwatch();
    open(() => {});
    expect(watcher).toHaveBeenCalledTimes(2);
  });
});

describe('browser Back button', () => {
  const MARK = 'mappeora-back';
  /** The app's page is on top of the history. */
  const armed = () => (history.state as Record<string, unknown> | null)?.[MARK] === true;
  const popstate = () => new Promise<void>((resolve) => window.addEventListener('popstate', () => setTimeout(resolve, 0), { once: true }));
  /** Settles onBack's promise and the sync that follows it. */
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  let mapOpen: boolean;
  let syncs: Set<() => void>;
  const watch = (sync: () => void) => {
    syncs.add(sync);
    return () => void syncs.delete(sync);
  };
  const setMapOpen = (value: boolean) => {
    mapOpen = value;
    syncs.forEach((s) => s());
  };
  let uninstall: (() => void) | undefined;

  beforeEach(async () => {
    mapOpen = false;
    syncs = new Set();
    // Leave the history as a fresh page: no app page on top.
    if (armed()) {
      const back = popstate();
      history.back();
      await back;
    }
    history.replaceState(null, '');
  });

  afterEach(() => uninstall?.());

  it('adds no page while nothing is open', () => {
    const before = history.length;
    uninstall = installWebBack(vi.fn(), () => mapOpen, watch);
    expect(history.length).toBe(before);
    expect(armed()).toBe(false);
  });

  it('adds one page when a map opens, and only one', () => {
    uninstall = installWebBack(vi.fn(), () => mapOpen, watch);
    const before = history.length;
    setMapOpen(true);
    setMapOpen(true);
    expect(history.length).toBe(before + 1);
    expect(armed()).toBe(true);
  });

  it('Back calls onBack, and the page comes back if the map is still open', async () => {
    mapOpen = true;
    const onBack = vi.fn();
    uninstall = installWebBack(onBack, () => mapOpen, watch);
    const pop = popstate();
    history.back();
    await pop;
    await settle();
    expect(onBack).toHaveBeenCalledOnce();
    expect(armed()).toBe(true);
  });

  it('Back that leaves the map does not put the page back', async () => {
    mapOpen = true;
    const onBack = vi.fn(() => {
      mapOpen = false;
    });
    uninstall = installWebBack(onBack, () => mapOpen, watch);
    const pop = popstate();
    history.back();
    await pop;
    await settle();
    expect(onBack).toHaveBeenCalledOnce();
    expect(armed()).toBe(false);
  });

  it('waits for an asked question («Rimani») before putting the page back', async () => {
    mapOpen = true;
    let answer!: () => void;
    const onBack = vi.fn(() => new Promise<void>((resolve) => (answer = resolve)));
    uninstall = installWebBack(onBack, () => mapOpen, watch);
    const pop = popstate();
    history.back();
    await pop;
    expect(armed()).toBe(false);
    answer();
    await settle();
    expect(armed()).toBe(true);
  });

  it('closing the map from the app takes its page back without calling onBack', async () => {
    const onBack = vi.fn();
    uninstall = installWebBack(onBack, () => mapOpen, watch);
    setMapOpen(true);
    const pop = popstate();
    setMapOpen(false);
    await pop;
    await settle();
    expect(onBack).not.toHaveBeenCalled();
    expect(armed()).toBe(false);
  });

  it('follows dialogs opened with useBackHandler', async () => {
    uninstall = installWebBack(vi.fn(), backIsHandled, watch);
    const d = open(() => {});
    expect(armed()).toBe(true);
    const pop = popstate();
    d.close();
    await pop;
    expect(armed()).toBe(false);
  });

  it('after a reload with its page still on top, it does not add another', () => {
    history.pushState({ [MARK]: true }, '');
    const before = history.length;
    mapOpen = true;
    uninstall = installWebBack(vi.fn(), () => mapOpen, watch);
    expect(history.length).toBe(before);
  });

  it('once undone, Back no longer calls onBack and changes are not followed', async () => {
    mapOpen = true;
    const onBack = vi.fn();
    installWebBack(onBack, () => mapOpen, watch)();
    expect(syncs.size).toBe(0);
    const pop = popstate();
    history.back();
    await pop;
    await settle();
    expect(onBack).not.toHaveBeenCalled();
  });
});
