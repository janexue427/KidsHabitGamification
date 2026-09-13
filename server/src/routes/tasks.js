import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { applyXpTransaction, recordXp } from '../utils/xp.js';
import { isDueOn, todayStr, isValidRecurrence } from '../utils/recurrence.js';
import { advanceMilestonesForKid } from '../utils/milestones.js';
import { currentStreak, streakProgress, awardStreakBonusIfDue, revokeStreakAwardFor } from '../utils/streak.js';
import { isValidDifficulty } from '../utils/difficulty.js';

const router = Router();

function taskWithAssignees(task) {
  const kidIds = db.prepare('SELECT kid_id FROM task_assignments WHERE task_id = ?').all(task.id).map((r) => r.kid_id);
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    icon: task.icon,
    xpValue: task.xp_value,
    recurrence: task.recurrence,
    daysOfWeek: task.days_of_week ? JSON.parse(task.days_of_week) : [],
    dayOfMonth: task.day_of_month ?? null,
    active: !!task.active,
    kidIds,
  };
}

// Parent: list all tasks in the family.
router.get('/', requireAuth, requireRole('parent'), (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE family_id = ? ORDER BY created_at DESC').all(req.user.familyId);
  res.json({ tasks: tasks.map(taskWithAssignees) });
});

// Parent: create a task.
router.post('/', requireAuth, requireRole('parent'), (req, res) => {
  const { title, description, icon, xpValue, recurrence, daysOfWeek, dayOfMonth, kidIds } = req.body || {};
  if (!title || !xpValue || !recurrence) {
    return res.status(400).json({ error: 'title, xpValue, recurrence are required' });
  }
  const invalid = validateSchedule({ recurrence, daysOfWeek, dayOfMonth });
  if (invalid) return res.status(400).json({ error: invalid });
  const now = new Date().toISOString();
  const id = nanoid();
  db.prepare(`
    INSERT INTO tasks (id, family_id, title, description, icon, xp_value, recurrence, days_of_week, day_of_month, active, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, req.user.familyId, title, description || '', icon || '✅', xpValue, recurrence,
    daysOfWeek ? JSON.stringify(daysOfWeek) : null,
    recurrence === 'monthly' ? Number(dayOfMonth) || 1 : null,
    req.user.id, now);

  assignKids(id, kidIds);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json({ task: taskWithAssignees(task) });
});

// Parent: update a task.
router.put('/:id', requireAuth, requireRole('parent'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND family_id = ?').get(req.params.id, req.user.familyId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, description, icon, xpValue, recurrence, daysOfWeek, dayOfMonth, kidIds, active } = req.body || {};
  if (recurrence !== undefined) {
    const invalid = validateSchedule({
      recurrence,
      daysOfWeek: daysOfWeek !== undefined ? daysOfWeek : JSON.parse(task.days_of_week || '[]'),
      dayOfMonth: dayOfMonth !== undefined ? dayOfMonth : task.day_of_month,
    });
    if (invalid) return res.status(400).json({ error: invalid });
  }
  const nextRecurrence = recurrence ?? task.recurrence;
  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, icon = ?, xp_value = ?, recurrence = ?, days_of_week = ?, day_of_month = ?, active = ?
    WHERE id = ?
  `).run(
    title ?? task.title,
    description ?? task.description,
    icon ?? task.icon,
    xpValue ?? task.xp_value,
    recurrence ?? task.recurrence,
    daysOfWeek !== undefined ? JSON.stringify(daysOfWeek) : task.days_of_week,
    nextRecurrence === 'monthly'
      ? Number(dayOfMonth ?? task.day_of_month) || 1
      : null,
    active !== undefined ? (active ? 1 : 0) : task.active,
    task.id
  );
  if (kidIds !== undefined) {
    db.prepare('DELETE FROM task_assignments WHERE task_id = ?').run(task.id);
    assignKids(task.id, kidIds);
  }
  const updated = db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id);
  res.json({ task: taskWithAssignees(updated) });
});

router.delete('/:id', requireAuth, requireRole('parent'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND family_id = ?').get(req.params.id, req.user.familyId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  // task_completions references this row, so deleting the task alone trips the
  // foreign key. Clear the dependents in one transaction. Earned XP is untouched:
  // xp_transactions is the ledger and does not point back at the task.
  db.transaction(() => {
    db.prepare('DELETE FROM task_completions WHERE task_id = ?').run(task.id);
    db.prepare('DELETE FROM task_assignments WHERE task_id = ?').run(task.id);
    db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  })();
  res.json({ ok: true });
});

// Kid: today's tasks with completion state.
router.get('/mine/today', requireAuth, requireRole('kid'), (req, res) => {
  const tasks = db.prepare('SELECT * FROM tasks WHERE family_id = ? AND active = 1').all(req.user.familyId);
  const today = todayStr();
  const mine = tasks.filter((t) => {
    const assigned = db.prepare('SELECT 1 FROM task_assignments WHERE task_id = ? AND kid_id = ?').get(t.id, req.user.id);
    return assigned && isDueOn(t, new Date());
  });
  const result = mine.map((t) => {
    const done = db.prepare(`
      SELECT id, difficulty FROM task_completions WHERE task_id = ? AND kid_id = ? AND completed_date = ?
    `).get(t.id, req.user.id, today);
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      icon: t.icon,
      xpValue: t.xp_value,
      recurrence: t.recurrence,
      completedToday: !!done,
      completionId: done?.id ?? null,
      difficulty: done?.difficulty ?? null,
    };
  });
  res.json({ tasks: result, date: today });
});

// How far ahead a quest may be ticked off. A week is enough to let a kid clear
// tomorrow's chores tonight without turning the whole thing into one sitting.
const LOOKAHEAD_DAYS = 7;

function assignedTasksFor(kidId, familyId) {
  return db
    .prepare(`
      SELECT t.* FROM tasks t
      JOIN task_assignments ta ON ta.task_id = t.id
      WHERE t.family_id = ? AND ta.kid_id = ? AND t.active = 1
    `)
    .all(familyId, kidId);
}

function shapeForDay(t, kidId, dateStr) {
  const done = db
    .prepare('SELECT id, difficulty, verified_at FROM task_completions WHERE task_id = ? AND kid_id = ? AND completed_date = ?')
    .get(t.id, kidId, dateStr);
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    icon: t.icon,
    xpValue: t.xp_value,
    recurrence: t.recurrence,
    date: dateStr,
    completed: Boolean(done),
    completionId: done?.id ?? null,
    difficulty: done?.difficulty ?? null,
    verified: Boolean(done?.verified_at),
  };
}

// Kid: the week ahead, so quests can be seen and finished before their day.
router.get('/mine/week', requireAuth, requireRole('kid'), (req, res) => {
  const mine = assignedTasksFor(req.user.id, req.user.familyId);
  const start = new Date();
  const days = [];

  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    const dateStr = todayStr(date);
    const due = mine.filter((t) => isDueOn(t, date));
    days.push({
      date: dateStr,
      weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
      offset,
      tasks: due.map((t) => shapeForDay(t, req.user.id, dateStr)),
    });
  }

  const streak = currentStreak(req.user.id);
  res.json({ days, ...streakProgress(streak) });
});

// Kid: complete a task for today, awards XP.
router.post('/:id/complete', requireAuth, requireRole('kid'), (req, res) => {
  const { difficulty } = req.body || {};
  if (difficulty !== undefined && difficulty !== null && !isValidDifficulty(difficulty)) {
    return res.status(400).json({ error: 'Unknown difficulty' });
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND family_id = ? AND active = 1').get(req.params.id, req.user.familyId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const assigned = db.prepare('SELECT 1 FROM task_assignments WHERE task_id = ? AND kid_id = ?').get(task.id, req.user.id);
  if (!assigned) return res.status(403).json({ error: 'This task is not assigned to you' });

  // A date may be given to tick off a quest before its day arrives.
  const today = todayStr();
  const requested = req.body?.date ? String(req.body.date) : today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
    return res.status(400).json({ error: 'date must look like YYYY-MM-DD' });
  }
  if (requested < today) {
    return res.status(400).json({ error: 'Quests cannot be completed for a day that has passed' });
  }
  const limit = new Date();
  limit.setDate(limit.getDate() + LOOKAHEAD_DAYS - 1);
  if (requested > todayStr(limit)) {
    return res.status(400).json({ error: `Quests can only be completed up to ${LOOKAHEAD_DAYS} days ahead` });
  }
  if (!isDueOn(task, new Date(`${requested}T00:00:00`))) {
    return res.status(400).json({ error: 'That quest is not scheduled for that day' });
  }

  const already = db.prepare(`
    SELECT 1 FROM task_completions WHERE task_id = ? AND kid_id = ? AND completed_date = ?
  `).get(task.id, req.user.id, requested);
  if (already) return res.status(409).json({ error: 'Already completed for that day' });

  const now = new Date().toISOString();
  const completionId = nanoid();
  db.prepare(`
    INSERT INTO task_completions (id, task_id, kid_id, completed_date, xp_awarded, difficulty, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(completionId, task.id, req.user.id, requested, task.xp_value, difficulty ?? null, now);

  applyXpTransaction({ kidId: req.user.id, amount: task.xp_value, type: 'task', sourceId: task.id, note: task.title });
  const milestoneResults = advanceMilestonesForKid(req.user.id, req.user.familyId);
  // Only a completion dated today can extend the run that ends today.
  const streakBonus = requested === today ? awardStreakBonusIfDue(req.user.id, today) : null;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const streak = currentStreak(req.user.id);
  res.json({
    ok: true,
    completionId,
    date: requested,
    aheadOfTime: requested > today,
    xpAwarded: task.xp_value,
    totalXp: user.total_xp,
    milestonesCompleted: milestoneResults,
    streakBonus,
    ...streakProgress(streak),
  });
});

// Kid: say how hard a completed task felt. Separate from completing it so the
// rating stays optional — the XP is never held hostage to answering.
router.post('/completions/:completionId/difficulty', requireAuth, requireRole('kid'), (req, res) => {
  const { difficulty } = req.body || {};
  if (!isValidDifficulty(difficulty)) return res.status(400).json({ error: 'Unknown difficulty' });

  const completion = db.prepare('SELECT * FROM task_completions WHERE id = ? AND kid_id = ?')
    .get(req.params.completionId, req.user.id);
  if (!completion) return res.status(404).json({ error: 'Completion not found' });

  db.prepare('UPDATE task_completions SET difficulty = ? WHERE id = ?').run(difficulty, completion.id);
  res.json({ ok: true, completionId: completion.id, difficulty });
});

// Parent: recent completions across the family, for checking over.
router.get('/completions', requireAuth, requireRole('parent'), (req, res) => {
  const status = req.query.status || 'all';
  const rows = db
    .prepare(`
      SELECT tc.*, t.title, t.icon, u.name AS kid_name, u.avatar AS kid_avatar
      FROM task_completions tc
      JOIN tasks t ON t.id = tc.task_id
      JOIN users u ON u.id = tc.kid_id
      WHERE t.family_id = ?
      ORDER BY tc.completed_date DESC, tc.created_at DESC
      LIMIT 100
    `)
    .all(req.user.familyId);

  const shaped = rows
    .filter((r) => (status === 'unverified' ? !r.verified_at : status === 'verified' ? r.verified_at : true))
    .map((r) => ({
      id: r.id,
      taskId: r.task_id,
      title: r.title,
      icon: r.icon,
      kidId: r.kid_id,
      kidName: r.kid_name,
      kidAvatar: r.kid_avatar,
      date: r.completed_date,
      xpAwarded: r.xp_awarded,
      difficulty: r.difficulty,
      verified: Boolean(r.verified_at),
      verifiedAt: r.verified_at,
    }));

  res.json({ completions: shaped });
});

function ownedCompletion(completionId, familyId) {
  return db
    .prepare(`
      SELECT tc.* FROM task_completions tc
      JOIN tasks t ON t.id = tc.task_id
      WHERE tc.id = ? AND t.family_id = ?
    `)
    .get(completionId, familyId);
}

// Parent: sign off on a completion.
router.post('/completions/:id/verify', requireAuth, requireRole('parent'), (req, res) => {
  const completion = ownedCompletion(req.params.id, req.user.familyId);
  if (!completion) return res.status(404).json({ error: 'Completion not found' });

  const verified = req.body?.verified !== false;
  db.prepare('UPDATE task_completions SET verified_at = ?, verified_by = ? WHERE id = ?')
    .run(verified ? new Date().toISOString() : null, verified ? req.user.id : null, completion.id);

  res.json({ ok: true, id: completion.id, verified });
});

/**
 * Parent: reset a completion, putting the quest back to not-done.
 *
 * Everything the completion caused is undone with it, or the XP total stops
 * matching the work: the award is reversed through the ledger, milestone
 * progress steps back, and a streak bonus earned that day is clawed back if the
 * reset breaks the run that earned it.
 */
router.delete('/completions/:id', requireAuth, requireRole('parent'), (req, res) => {
  const completion = ownedCompletion(req.params.id, req.user.familyId);
  if (!completion) return res.status(404).json({ error: 'Completion not found' });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(completion.task_id);

  db.transaction(() => {
    db.prepare('DELETE FROM task_completions WHERE id = ?').run(completion.id);
    recordXp({
      kidId: completion.kid_id,
      amount: -completion.xp_awarded,
      type: 'task',
      sourceId: completion.task_id,
      note: `${task?.title ?? 'Quest'} reset by a parent`,
    });
    // Step milestone progress back for anything not already finished. A
    // milestone already completed keeps its bonus: it was genuinely reached at
    // the time, and unpicking a past celebration helps nobody.
    db.prepare(`
      UPDATE milestone_assignments SET progress = MAX(progress - 1, 0)
      WHERE kid_id = ? AND completed_at IS NULL
    `).run(completion.kid_id);
  })();

  // If that day no longer has any completion, a bonus earned on it is void.
  const stillHasWork = db
    .prepare('SELECT 1 FROM task_completions WHERE kid_id = ? AND completed_date = ?')
    .get(completion.kid_id, completion.completed_date);
  const revoked = stillHasWork ? null : revokeStreakAwardFor(completion.kid_id, completion.completed_date);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(completion.kid_id);
  res.json({
    ok: true,
    xpReversed: completion.xp_awarded,
    streakBonusRevoked: revoked ? revoked.xp : 0,
    totalXp: user.total_xp,
  });
});

// A schedule that cannot come round is a silent dead task, so the parts each
// recurrence depends on are required rather than defaulted.
function validateSchedule({ recurrence, daysOfWeek, dayOfMonth }) {
  if (!isValidRecurrence(recurrence)) return 'Unknown recurrence';
  if (recurrence === 'weekly' || recurrence === 'custom') {
    const days = Array.isArray(daysOfWeek) ? daysOfWeek : [];
    if (days.length === 0) return 'Pick at least one day of the week';
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return 'Days of the week must be 0 (Sun) to 6 (Sat)';
    if (recurrence === 'weekly' && days.length > 1) return 'A weekly task runs on a single day';
  }
  if (recurrence === 'monthly') {
    const d = Number(dayOfMonth);
    if (!Number.isInteger(d) || d < 1 || d > 31) return 'Day of the month must be between 1 and 31';
  }
  return null;
}

function assignKids(taskId, kidIds) {
  if (!Array.isArray(kidIds)) return;
  const stmt = db.prepare('INSERT OR IGNORE INTO task_assignments (task_id, kid_id) VALUES (?, ?)');
  for (const kidId of kidIds) stmt.run(taskId, kidId);
}

export default router;
