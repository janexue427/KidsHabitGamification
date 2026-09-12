import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

function shape(r) {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    icon: r.icon,
    xpCost: r.xp_cost,
    category: r.category,
    active: !!r.active,
  };
}

// Kid: browse active rewards.
router.get('/', requireAuth, (req, res) => {
  const rows = req.user.role === 'parent'
    ? db.prepare('SELECT * FROM rewards WHERE family_id = ? ORDER BY xp_cost').all(req.user.familyId)
    : db.prepare('SELECT * FROM rewards WHERE family_id = ? AND active = 1 ORDER BY xp_cost').all(req.user.familyId);
  res.json({ rewards: rows.map(shape) });
});

router.post('/', requireAuth, requireRole('parent'), (req, res) => {
  const { title, description, icon, xpCost, category } = req.body || {};
  if (!title || !xpCost) return res.status(400).json({ error: 'title and xpCost are required' });
  const now = new Date().toISOString();
  const id = nanoid();
  db.prepare(`
    INSERT INTO rewards (id, family_id, title, description, icon, xp_cost, category, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(id, req.user.familyId, title, description || '', icon || '🎁', xpCost, category || 'outing', now);
  const row = db.prepare('SELECT * FROM rewards WHERE id = ?').get(id);
  res.status(201).json({ reward: shape(row) });
});

router.put('/:id', requireAuth, requireRole('parent'), (req, res) => {
  const r = db.prepare('SELECT * FROM rewards WHERE id = ? AND family_id = ?').get(req.params.id, req.user.familyId);
  if (!r) return res.status(404).json({ error: 'Reward not found' });
  const { title, description, icon, xpCost, category, active } = req.body || {};
  db.prepare(`
    UPDATE rewards SET title = ?, description = ?, icon = ?, xp_cost = ?, category = ?, active = ?
    WHERE id = ?
  `).run(
    title ?? r.title,
    description ?? r.description,
    icon ?? r.icon,
    xpCost ?? r.xp_cost,
    category ?? r.category,
    active !== undefined ? (active ? 1 : 0) : r.active,
    r.id
  );
  const updated = db.prepare('SELECT * FROM rewards WHERE id = ?').get(r.id);
  res.json({ reward: shape(updated) });
});

router.delete('/:id', requireAuth, requireRole('parent'), (req, res) => {
  const r = db.prepare('SELECT * FROM rewards WHERE id = ? AND family_id = ?').get(req.params.id, req.user.familyId);
  if (!r) return res.status(404).json({ error: 'Reward not found' });
  db.prepare('DELETE FROM rewards WHERE id = ?').run(r.id);
  res.json({ ok: true });
});

export default router;
