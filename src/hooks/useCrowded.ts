import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSettings } from '../store/settingsStore';

/**
 * Whether a bar's buttons do not all fit on one row. How wide they are
 * depends on the text size, the font and the spacing the child chose, so the
 * bar is measured, not guessed from the screen width. While crowded, the
 * width they needed is remembered: the bar goes back to full only when there
 * is that much room (turning the tablet, a smaller text), never flickering.
 *
 * Returns the ref for the bar (it may come and go, as during review).
 */
export function useCrowded(): [(el: HTMLElement | null) => void, boolean] {
  const look = useSettings((s) => `${s.font}|${s.uppercase}|${s.textScale}|${s.wideSpacing}`);
  const [bar, setBar] = useState<HTMLElement | null>(null);
  const [crowded, setCrowded] = useState(false);
  const needed = useRef(0);

  // Other words, other widths: measure again from the full bar.
  useEffect(() => setCrowded(false), [look]);

  // Before the bar is painted: a bar that does not fit is never seen cut.
  useLayoutEffect(() => {
    if (!bar) return;
    const check = () => {
      if (!crowded && bar.scrollWidth > bar.clientWidth + 1) {
        needed.current = bar.scrollWidth;
        setCrowded(true);
      } else if (crowded && bar.clientWidth >= needed.current) setCrowded(false);
    };
    check();
    // The bar when the window changes, its buttons when a font arrives.
    const observer = new ResizeObserver(check);
    observer.observe(bar);
    for (const button of bar.children) observer.observe(button);
    return () => observer.disconnect();
  }, [bar, crowded, look]);

  return [setBar, crowded];
}
