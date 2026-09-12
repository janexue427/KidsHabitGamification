import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

function withAssignees(m) {
  const assignments = db.prepare('SELECT kid_id, progress, completed_at FROM milestone_assignments WHERE milestone_id = ?').all(m.id);
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    icon: m.icon,
    targetCount: m.target_count,
    bonusXp: m.bonus_xp,
    active: !!m.active,
    assignments: assignments.map((a) => ({
      kidId: a.kid_id,
      progress: a.progress,
      completedAt: a.completed_at,
    })),
  };
}

router.get('/', requireAuth, requireRole('parent'), (req, res) => {
  const milestones = db.prepare('SELECT * FROM milestones WHERE family_id = ? ORDER BY created_at DESC').all(req.user.familyId);
  res.json({ milestones: milestones.map(withAssignees) });
});

router.post('/', requireAuth, requireRole('parent'), (req, res) => {
  const { title, description, icon, targetCount, bonusXp, kidIds } = req.body || {};
  if (!title || !targetCount || !bonusXp) {
    return res.status(400).json({ error: 'title, targetCount, bonusXp are required' });
  }
  const now = new Date().toISOString();
  const id = nanoid();
  db.prepare(`
    INSERT INTO milestones (id, family_id, title, description, icon, target_count, bonus_xp, active, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(id, req.user.familyId, title, description || '', icon || '🏆', targetCount, bonusXp, req.user.id, now);
  assignKids(id, kidIds);
  const m = db.prepare('SELECT * FROM milestones WHERE id = ?').get(id);
  res.status(201).json({ milestone: withAssignees(m) });
});

router.put('/:id', requireAuth, requireRole('parent'), (req, res) => {
  const m = db.prepare('SELECT * FROM milestones WHERE id = ? AND family_id = ?').get(req.params.id, req.user.familyId);
  if (!m) return res.status(404).json({ error: 'Milestone not found' });
  const { title, description, icon, targetCount, bonusXp, kidIds, active } = req.body || {};
  db.prepare(`
    UPDATE milestones SET title = ?, description = ?, icon = ?, target_count = ?, bonus_xp = ?, active = ?
    WHERE id = ?
  `).run(
    title ?? m.title,
    description ?? m.description,
    icon ?? m.icon,
    targetCount ?? m.target_count,
    bonusXp ?? m.bonus_xp,
    active !== undefined ? (active ? 1 : 0) : m.active,
    m.id
  );
  if (kidIds !== undefined) {
    db.prepare('DELETE FROM milestone_assignments WHERE milestone_id = ?').run(m.id);
    assignKids(m.id, kidIds);
  }
  const updated = db.prepare('SELECT * FROM milestones WHERE id = ?').get(m.id);
  res.json({ milestone: withAssignees(updated) });
});

router.delete('/:id', requireAuth, requireRole('parent'), (req, res) => {
  const m = db.prepare('SELECT * FROM milestones WHERE id = ? AND family_id = ?').get(req.params.id, req.user.familyId);
  if (!m) return res.status(404).json({ error: 'Milestone not found' });
  db.prepare('DELETE FROM milestone_assignments WHERE milestone_id = ?').run(m.id);
  db.prepare('DELETE FROM milestones WHERE id = ?').run(m.id);
  res.json({ ok: true });
});

// Kid: their own milestones with progress.
router.get('/mine', requireAuth, requireRole('kid'), (req, res) => {
  const rows = db.prepare(`
    SELECT m.*, ma.progress, ma.completed_at
    FROM milestone_assignments ma
    JOIN milestones m ON m.id = ma.milestone_id
    WHERE ma.kid_id = ? AND m.active = 1
    ORDER BY m.created_at DESC
  `).all(req.user.id);
  res.json({
    milestones: rows.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      icon: m.icon,
      targetCount: m.target_count,
      bonusXp: m.bonus_xp,
      progress: m.progress,
      completedAt: m.completed_at,
    })),
  });
});

function assignKids(milestoneId, kidIds) {
  if (!Array.isArray(kidIds)) return;
  const stmt = db.prepare('INSERT OR IGNORE INTO milestone_assignments (milestone_id, kid_id, progress) VALUES (?, ?, 0)');
  for (const kidId of kidIds) stmt.run(milestoneId, kidId);
}

export default router;
