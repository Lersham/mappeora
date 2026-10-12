import { Capacitor } from '@capacitor/core';

/** True inside the Android/iOS app shell, false on web/PWA. */
export const isNative = (): boolean => Capacitor.isNativePlatform();

export const platform = (): 'web' | 'android' | 'ios' =>
  Capacitor.getPlatform() as 'web' | 'android' | 'ios';

/** iPhone or iPad (iPadOS says it is a Mac, with a touch screen). */
export const isAppleMobile = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Opened from the Home screen: an app of its own, without the browser's bars. */
export const isHomeScreenApp = (): boolean =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true || !!window.matchMedia?.('(display-mode: standalone)').matches;
