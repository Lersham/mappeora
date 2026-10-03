import { Capacitor } from '@capacitor/core';

/** True inside the Android/iOS app shell, false on web/PWA. */
export const isNative = (): boolean => Capacitor.isNativePlatform();

export const platform = (): 'web' | 'android' | 'ios' =>
  Capacitor.getPlatform() as 'web' | 'android' | 'ios';
