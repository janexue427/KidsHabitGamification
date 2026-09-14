import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { todayIn, addDays, weekdayOf, familyTimezone } from '../utils/calendar.js';
// One definition of a streak for both portals: counting future completions here
// would show the parent a longer run than the kid sees.
import { currentStreak, streakProgress } from '../utils/streak.js';

const router = Router();

// Monday of the week the family is currently in, in civil terms.
function startOfWeek(today) {
  const dow = weekdayOf(today) || 7; // Sunday counts as the 7th day
  return addDays(today, -(dow - 1));
}

router.get('/', requireAuth, requireRole('parent'), (req, res) => {
  const timezone = familyTimezone(db, req.user.familyId);
  const today = todayIn(timezone);
  const kids = db.prepare("SELECT * FROM users WHERE family_id = ? AND role = 'kid' ORDER BY created_at").all(req.user.familyId);
  const weekStart = startOfWeek(today);

  const kidSummaries = kids.map((kid) => {
    const streak = currentStreak(kid.id, today);
    const tasksThisWeek = db.prepare(`
      SELECT COUNT(*) AS c FROM task_completions WHERE kid_id = ? AND completed_date >= ?
    `).get(kid.id, weekStart).c;
    const pendingSuggestions = db.prepare(`
      SELECT COUNT(*) AS c FROM suggestions WHERE kid_id = ? AND status = 'pending'
    `).get(kid.id).c;
    const pendingRedemptions = db.prepare(`
      SELECT COUNT(*) AS c FROM redemptions WHERE kid_id = ? AND status = 'pending'
    `).get(kid.id).c;
    return {
      id: kid.id,
      name: kid.name,
      avatar: kid.avatar,
      totalXp: kid.total_xp,
      streak,
      daysToBonus: streakProgress(streak).daysToBonus,
      tasksThisWeek,
      pendingSuggestions,
      pendingRedemptions,
    };
  });

  const kidIds = kids.map((k) => k.id);
  let activity = [];
  if (kidIds.length) {
    const placeholders = kidIds.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT * FROM xp_transactions WHERE kid_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 25
    `).all(...kidIds);
    const kidById = Object.fromEntries(kids.map((k) => [k.id, k]));
    // Newer rows name their completion outright. Older ones predate that column,
    // so they fall back to matching on kid, task and day — which is only right
    // for rows written while dates were still UTC.
    const byCompletion = db.prepare('SELECT difficulty FROM task_completions WHERE id = ?');
    const byDay = db.prepare(`
      SELECT difficulty FROM task_completions
      WHERE kid_id = ? AND task_id = ? AND completed_date = date(?)
    `);
    activity = rows.map((r) => ({
      id: r.id,
      kidName: kidById[r.kid_id]?.name,
      kidAvatar: kidById[r.kid_id]?.avatar,
      amount: r.amount,
      type: r.type,
      note: r.note,
      createdAt: r.created_at,
      difficulty:
        r.type !== 'task'
          ? null
          : r.completion_id
            ? byCompletion.get(r.completion_id)?.difficulty ?? null
            : r.source_id
              ? byDay.get(r.kid_id, r.source_id, r.created_at)?.difficulty ?? null
              : null,
    }));
  }

  res.json({
    kids: kidSummaries,
    timezone,
    activity,
    pendingSuggestions: db.prepare("SELECT COUNT(*) AS c FROM suggestions WHERE family_id = ? AND status = 'pending'").get(req.user.familyId).c,
    pendingRedemptions: kidIds.length
      ? db.prepare(`SELECT COUNT(*) AS c FROM redemptions WHERE kid_id IN (${kidIds.map(() => '?').join(',')}) AND status = 'pending'`).get(...kidIds).c
      : 0,
  });
});

export default router;
