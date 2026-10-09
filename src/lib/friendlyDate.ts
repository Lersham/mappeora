const weekday = new Intl.DateTimeFormat('it-IT', { weekday: 'long' });
const dayMonth = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' });
const dayMonthYear = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

/** Midnight of the day `t` falls on, in local time. */
const dayStart = (t: number) => new Date(t).setHours(0, 0, 0, 0);

/**
 * When a map was last changed, as a child says it: «Oggi», «Ieri»,
 * «Lunedì» within the week, then «3 ottobre» (and the year only when it is
 * not this one). Easier to read than 09/10/2026, and no digits to decode.
 */
export function friendlyDate(t: number, now = Date.now()): string {
  const days = Math.round((dayStart(now) - dayStart(t)) / 86_400_000);
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Ieri';
  if (days > 1 && days < 7) {
    const name = weekday.format(t);
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return new Date(t).getFullYear() === new Date(now).getFullYear() ? dayMonth.format(t) : dayMonthYear.format(t);
}
