/** A touch screen: the main pointer is a finger, and typing opens the on-screen keyboard. */
export const TOUCH = typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false);
