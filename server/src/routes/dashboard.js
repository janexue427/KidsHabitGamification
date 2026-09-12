import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { todayStr } from '../utils/recurrence.js';

const router = Router();

function currentStreak(kidId) {
  const dates = new Set(
    db.prepare('SELECT DISTINCT completed_date FROM task_completions WHERE kid_id = ?').all(kidId).map((r) => r.completed_date)
  );
  let streak = 0;
  const cursor = new Date();
  // allow today to be "in progress" without breaking the streak
  if (!dates.has(todayStr(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(todayStr(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function startOfWeek() {
  const d = new Date();
  const day = d.getDay() || 7;
  if (day !== 1) d.setDate(d.getDate() - (day - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

router.get('/', requireAuth, requireRole('parent'), (req, res) => {
  const kids = db.prepare("SELECT * FROM users WHERE family_id = ? AND role = 'kid' ORDER BY created_at").all(req.user.familyId);
  const weekStart = startOfWeek();

  const kidSummaries = kids.map((kid) => {
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
      streak: currentStreak(kid.id),
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
    // XP rows don't reference a completion, so match the one they came from:
    // same kid, same task, same calendar day.
    const difficultyFor = db.prepare(`
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
      difficulty: r.type === 'task' && r.source_id
        ? difficultyFor.get(r.kid_id, r.source_id, r.created_at)?.difficulty ?? null
        : null,
    }));
  }

  res.json({
    kids: kidSummaries,
    activity,
    pendingSuggestions: db.prepare("SELECT COUNT(*) AS c FROM suggestions WHERE family_id = ? AND status = 'pending'").get(req.user.familyId).c,
    pendingRedemptions: kidIds.length
      ? db.prepare(`SELECT COUNT(*) AS c FROM redemptions WHERE kid_id IN (${kidIds.map(() => '?').join(',')}) AND status = 'pending'`).get(...kidIds).c
      : 0,
  });
});

export default router;
