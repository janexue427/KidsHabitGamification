/**
 * Civil dates for a family.
 *
 * "Today" has to mean the family's today. Deriving it from UTC means the day
 * rolls over at 8pm in New York, so an evening quest is filed against tomorrow,
 * breaks the streak, and vanishes from the list it was just completed on.
 *
 * Everything downstream works in plain YYYY-MM-DD strings. Once a date is a
 * civil string there is no timezone left in it to get wrong, and comparisons,
 * storage and arithmetic are all unambiguous.
 */
export const DEFAULT_TIMEZONE = 'America/New_York';

export function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map();
function formatterFor(timezone) {
  let f = formatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatters.set(timezone, f);
  }
  return f;
}

/** The calendar date where this family lives, as YYYY-MM-DD. */
export function todayIn(timezone = DEFAULT_TIMEZONE, at = new Date()) {
  const tz = isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const parts = formatterFor(tz).formatToParts(at);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/**
 * Day of the week for a civil date, 0 = Sunday.
 * Read from the string at UTC noon, so no timezone or DST shift can move it.
 */
export function weekdayOf(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay();
}

/** Shift a civil date by whole days, staying in civil terms throughout. */
export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days in the month a civil date falls in — for monthly quests near month end. */
export function daysInMonthOf(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Day of the month, as a number. */
export function dayOfMonthOf(dateStr) {
  return Number(dateStr.slice(8, 10));
}

/** A long weekday name, for showing the week ahead. */
export function weekdayName(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: 'UTC',
  });
}

/** The family's timezone, falling back to the default if it is unset or junk. */
export function familyTimezone(db, familyId) {
  const row = db.prepare('SELECT timezone FROM families WHERE id = ?').get(familyId);
  const tz = row?.timezone;
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}
