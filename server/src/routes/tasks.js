import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { applyXpTransaction } from '../utils/xp.js';
import { isDueOn, todayStr } from '../utils/recurrence.js';
import { advanceMilestonesForKid } from '../utils/milestones.js';
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
  const { title, description, icon, xpValue, recurrence, daysOfWeek, kidIds } = req.body || {};
  if (!title || !xpValue || !recurrence) {
    return res.status(400).json({ error: 'title, xpValue, recurrence are required' });
  }
  const now = new Date().toISOString();
  const id = nanoid();
  db.prepare(`
    INSERT INTO tasks (id, family_id, title, description, icon, xp_value, recurrence, days_of_week, active, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, req.user.familyId, title, description || '', icon || '✅', xpValue, recurrence,
    daysOfWeek ? JSON.stringify(daysOfWeek) : null, req.user.id, now);

  assignKids(id, kidIds);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.status(201).json({ task: taskWithAssignees(task) });
});

// Parent: update a task.
router.put('/:id', requireAuth, requireRole('parent'), (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND family_id = ?').get(req.params.id, req.user.familyId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const { title, description, icon, xpValue, recurrence, daysOfWeek, kidIds, active } = req.body || {};
  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, icon = ?, xp_value = ?, recurrence = ?, days_of_week = ?, active = ?
    WHERE id = ?
  `).run(
    title ?? task.title,
    description ?? task.description,
    icon ?? task.icon,
    xpValue ?? task.xp_value,
    recurrence ?? task.recurrence,
    daysOfWeek !== undefined ? JSON.stringify(daysOfWeek) : task.days_of_week,
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
  db.prepare('DELETE FROM task_assignments WHERE task_id = ?').run(task.id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
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

  const today = todayStr();
  const already = db.prepare(`
    SELECT 1 FROM task_completions WHERE task_id = ? AND kid_id = ? AND completed_date = ?
  `).get(task.id, req.user.id, today);
  if (already) return res.status(409).json({ error: 'Already completed today' });

  const now = new Date().toISOString();
  const completionId = nanoid();
  db.prepare(`
    INSERT INTO task_completions (id, task_id, kid_id, completed_date, xp_awarded, difficulty, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(completionId, task.id, req.user.id, today, task.xp_value, difficulty ?? null, now);

  applyXpTransaction({ kidId: req.user.id, amount: task.xp_value, type: 'task', sourceId: task.id, note: task.title });
  const milestoneResults = advanceMilestonesForKid(req.user.id, req.user.familyId);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({
    ok: true,
    completionId,
    xpAwarded: task.xp_value,
    totalXp: user.total_xp,
    milestonesCompleted: milestoneResults,
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

function assignKids(taskId, kidIds) {
  if (!Array.isArray(kidIds)) return;
  const stmt = db.prepare('INSERT OR IGNORE INTO task_assignments (task_id, kid_id) VALUES (?, ?)');
  for (const kidId of kidIds) stmt.run(taskId, kidId);
}

export default router;
