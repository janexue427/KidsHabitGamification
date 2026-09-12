// recurrence: 'daily' | 'weekdays' | 'custom' (with days_of_week JSON array, 0=Sun..6=Sat)
export function isDueOn(task, date) {
  const dow = date.getDay();
  if (task.recurrence === 'daily') return true;
  if (task.recurrence === 'weekdays') return dow >= 1 && dow <= 5;
  if (task.recurrence === 'custom') {
    try {
      const days = JSON.parse(task.days_of_week || '[]');
      return days.includes(dow);
    } catch {
      return false;
    }
  }
  return true;
}

export function todayStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
