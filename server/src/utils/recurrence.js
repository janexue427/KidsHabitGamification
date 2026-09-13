// How often a task comes round.
//
//   daily     every day
//   weekdays  Mon–Fri
//   weekly    one chosen weekday        (days_of_week, a single entry)
//   custom    several chosen weekdays   (days_of_week, 0=Sun..6=Sat)
//   monthly   a chosen day of the month (day_of_month, 1..31)
export const RECURRENCES = ['daily', 'weekdays', 'weekly', 'custom', 'monthly'];

export function isValidRecurrence(value) {
  return RECURRENCES.includes(value);
}

function parseDays(json) {
  try {
    const days = JSON.parse(json || '[]');
    return Array.isArray(days) ? days : [];
  } catch {
    return [];
  }
}

function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function isDueOn(task, date) {
  const dow = date.getDay();
  switch (task.recurrence) {
    case 'daily':
      return true;
    case 'weekdays':
      return dow >= 1 && dow <= 5;
    case 'weekly':
    case 'custom':
      return parseDays(task.days_of_week).includes(dow);
    case 'monthly': {
      // A task set for the 31st still has to happen in February, so a target
      // past the end of the month lands on the last day instead of vanishing.
      const target = Number(task.day_of_month) || 1;
      return date.getDate() === Math.min(target, daysInMonth(date));
    }
    default:
      // Unrecognised value means corrupt data. Showing the task every day is
      // noticeable and fixable; hiding it silently is not.
      return true;
  }
}

export function todayStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
