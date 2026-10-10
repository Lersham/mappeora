import { describe, expect, it } from 'vitest';
import { friendlyDate } from './friendlyDate';

// Friday 9 October 2026, mid-afternoon (local time).
const now = new Date(2026, 9, 9, 15, 30).getTime();
const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).getTime();

describe('friendlyDate', () => {
  it('says today and yesterday by calendar day, not by hours', () => {
    expect(friendlyDate(at(2026, 10, 9, 0), now)).toBe('Oggi');
    expect(friendlyDate(at(2026, 10, 9, 23), now)).toBe('Oggi');
    expect(friendlyDate(at(2026, 10, 8, 23), now)).toBe('Ieri');
    expect(friendlyDate(at(2026, 10, 8, 0), now)).toBe('Ieri');
  });

  it('names the day within the last week', () => {
    expect(friendlyDate(at(2026, 10, 7), now)).toBe('Mercoledì');
    expect(friendlyDate(at(2026, 10, 3), now)).toBe('Sabato');
  });

  it('gives day and month after a week, and the year only when it is another one', () => {
    expect(friendlyDate(at(2026, 10, 2), now)).toBe('2 ottobre');
    expect(friendlyDate(at(2026, 1, 15), now)).toBe('15 gennaio');
    expect(friendlyDate(at(2025, 12, 20), now)).toBe('20 dicembre 2025');
  });

  it('a date in the future (a clock set wrong) is just a date', () => {
    expect(friendlyDate(at(2026, 10, 12), now)).toBe('12 ottobre');
  });
});
