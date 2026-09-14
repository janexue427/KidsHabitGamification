import { nanoid } from 'nanoid';
import db from '../db.js';
import { addDays } from './calendar.js';
import { recordXp } from './xp.js';

export const STREAK_BONUS_EVERY = 7;
export const STREAK_BONUS_XP = 100;

/**
 * Consecutive days a kid has completed something, counting back from today.
 *
 * Completions dated in the future are deliberately ignored. Quests can be done
 * ahead of time, and counting those would let a kid clear the whole week in one
 * sitting and collect a "7 day streak" — the opposite of the habit this is
 * meant to encourage. Those days start counting when they arrive.
 *
 * Today still being unfinished does not break the streak; it simply has not
 * been added to it yet.
 */
export function currentStreak(kidId, today) {
  const done = new Set(
    db
      .prepare('SELECT DISTINCT completed_date FROM task_completions WHERE kid_id = ? AND completed_date <= ?')
      .all(kidId, today)
      .map((r) => r.completed_date)
  );

  let cursor = today;
  if (!done.has(cursor)) cursor = addDays(cursor, -1);

  let streak = 0;
  while (done.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Days still to go before the next bonus, and the streak that would earn it. */
export function streakProgress(streak) {
  const into = streak % STREAK_BONUS_EVERY;
  return {
    streak,
    intoCycle: into,
    daysToBonus: streak === 0 ? STREAK_BONUS_EVERY : STREAK_BONUS_EVERY - into || STREAK_BONUS_EVERY,
    nextBonusAt: streak + (STREAK_BONUS_EVERY - into || STREAK_BONUS_EVERY),
  };
}

/**
 * Pay the streak bonus if today completed a full run of seven.
 *
 * Idempotent by construction: the award is keyed on the kid and the date, so
 * repeated calls on the same day collide with the unique index and pay nothing.
 * Called after every completion, since that is when a streak can grow.
 */
export function awardStreakBonusIfDue(kidId, today) {
  const streak = currentStreak(kidId, today);
  if (streak === 0 || streak % STREAK_BONUS_EVERY !== 0) return null;

  const already = db
    .prepare('SELECT 1 FROM streak_awards WHERE kid_id = ? AND awarded_date = ?')
    .get(kidId, today);
  if (already) return null;

  const note = `${streak}-day streak bonus`;
  const award = { streak, xp: STREAK_BONUS_XP, note };

  db.transaction(() => {
    db.prepare(`
      INSERT INTO streak_awards (id, kid_id, awarded_date, streak_length, xp, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(nanoid(), kidId, today, streak, STREAK_BONUS_XP, new Date().toISOString());
    recordXp({ kidId, amount: STREAK_BONUS_XP, type: 'boost', sourceId: `streak:${today}`, note });
  })();

  return award;
}

/**
 * Undo a streak award for a date, used when a parent resets the completion that
 * earned it. The XP is reversed through the ledger rather than edited away, so
 * the history still explains how the total got where it is.
 */
export function revokeStreakAwardFor(kidId, date) {
  const award = db
    .prepare('SELECT * FROM streak_awards WHERE kid_id = ? AND awarded_date = ?')
    .get(kidId, date);
  if (!award) return null;

  db.transaction(() => {
    db.prepare('DELETE FROM streak_awards WHERE id = ?').run(award.id);
    recordXp({
      kidId,
      amount: -award.xp,
      type: 'boost',
      sourceId: `streak-revoked:${date}`,
      note: `${award.streak_length}-day streak bonus reversed`,
    });
  })();

  return award;
}
