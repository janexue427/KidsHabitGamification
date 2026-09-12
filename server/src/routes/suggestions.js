import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

function shape(s) {
  const kid = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(s.kid_id);
  return {
    id: s.id,
    type: s.type,
    title: s.title,
    description: s.description,
    proposedXp: s.proposed_xp,
    status: s.status,
    parentNote: s.parent_note,
    createdAt: s.created_at,
    resolvedAt: s.resolved_at,
    kid: kid ? { id: kid.id, name: kid.name, avatar: kid.avatar } : null,
  };
}

// Kid: submit a suggestion for a new task or milestone.
router.post('/', requireAuth, requireRole('kid'), (req, res) => {
  const { type, title, description, proposedXp } = req.body || {};
  if (!type || !title || !['task', 'milestone'].includes(type)) {
    return res.status(400).json({ error: 'type (task|milestone) and title are required' });
  }
  const now = new Date().toISOString();
  const id = nanoid();
  db.prepare(`
    INSERT INTO suggestions (id, family_id, kid_id, type, title, description, proposed_xp, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, req.user.familyId, req.user.id, type, title, description || '', proposedXp || null, now);
  const row = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
  res.status(201).json({ suggestion: shape(row) });
});

// Kid: view their own suggestions.
router.get('/mine', requireAuth, requireRole('kid'), (req, res) => {
  const rows = db.prepare('SELECT * FROM suggestions WHERE kid_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json({ suggestions: rows.map(shape) });
});

// Parent: view all suggestions in the family (optionally filter by status).
router.get('/', requireAuth, requireRole('parent'), (req, res) => {
  const { status } = req.query;
  const rows = status
    ? db.prepare('SELECT * FROM suggestions WHERE family_id = ? AND status = ? ORDER BY created_at DESC').all(req.user.familyId, status)
    : db.prepare('SELECT * FROM suggestions WHERE family_id = ? ORDER BY created_at DESC').all(req.user.familyId);
  res.json({ suggestions: rows.map(shape) });
});

// Parent: approve or reject a suggestion.
router.post('/:id/resolve', requireAuth, requireRole('parent'), (req, res) => {
  const { decision, parentNote } = req.body || {};
  if (!['approved', 'rejected'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approved or rejected' });
  }
  const s = db.prepare('SELECT * FROM suggestions WHERE id = ? AND family_id = ?').get(req.params.id, req.user.familyId);
  if (!s) return res.status(404).json({ error: 'Suggestion not found' });
  if (s.status !== 'pending') return res.status(409).json({ error: 'Suggestion already resolved' });

  db.prepare(`
    UPDATE suggestions SET status = ?, parent_note = ?, resolved_at = ? WHERE id = ?
  `).run(decision, parentNote || null, new Date().toISOString(), s.id);

  const updated = db.prepare('SELECT * FROM suggestions WHERE id = ?').get(s.id);
  res.json({ suggestion: shape(updated) });
});

export default router;
