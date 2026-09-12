import { Router } from 'express';
import { nanoid } from 'nanoid';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { applyXpTransaction } from '../utils/xp.js';

const router = Router();

function shape(r) {
  const reward = db.prepare('SELECT * FROM rewards WHERE id = ?').get(r.reward_id);
  const kid = db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(r.kid_id);
  return {
    id: r.id,
    status: r.status,
    xpCost: r.xp_cost,
    requestedAt: r.requested_at,
    resolvedAt: r.resolved_at,
    parentNote: r.parent_note,
    reward: reward ? { id: reward.id, title: reward.title, icon: reward.icon, category: reward.category } : null,
    kid: kid ? { id: kid.id, name: kid.name, avatar: kid.avatar } : null,
  };
}

// Kid: request to redeem a reward.
router.post('/', requireAuth, requireRole('kid'), (req, res) => {
  const { rewardId } = req.body || {};
  const reward = db.prepare('SELECT * FROM rewards WHERE id = ? AND family_id = ? AND active = 1').get(rewardId, req.user.familyId);
  if (!reward) return res.status(404).json({ error: 'Reward not found' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (user.total_xp < reward.xp_cost) {
    return res.status(400).json({ error: 'Not enough XP for this reward yet' });
  }

  const now = new Date().toISOString();
  const id = nanoid();
  db.prepare(`
    INSERT INTO redemptions (id, reward_id, kid_id, xp_cost, status, requested_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(id, reward.id, req.user.id, reward.xp_cost, now);
  const row = db.prepare('SELECT * FROM redemptions WHERE id = ?').get(id);
  res.status(201).json({ redemption: shape(row) });
});

router.get('/mine', requireAuth, requireRole('kid'), (req, res) => {
  const rows = db.prepare('SELECT * FROM redemptions WHERE kid_id = ? ORDER BY requested_at DESC').all(req.user.id);
  res.json({ redemptions: rows.map(shape) });
});

router.get('/', requireAuth, requireRole('parent'), (req, res) => {
  const { status } = req.query;
  const kidIds = db.prepare("SELECT id FROM users WHERE family_id = ? AND role = 'kid'").all(req.user.familyId).map((k) => k.id);
  if (kidIds.length === 0) return res.json({ redemptions: [] });
  const placeholders = kidIds.map(() => '?').join(',');
  const rows = status
    ? db.prepare(`SELECT * FROM redemptions WHERE kid_id IN (${placeholders}) AND status = ? ORDER BY requested_at DESC`).all(...kidIds, status)
    : db.prepare(`SELECT * FROM redemptions WHERE kid_id IN (${placeholders}) ORDER BY requested_at DESC`).all(...kidIds);
  res.json({ redemptions: rows.map(shape) });
});

// Parent: approve (deducts XP), reject, or mark fulfilled.
router.post('/:id/resolve', requireAuth, requireRole('parent'), (req, res) => {
  const { decision, parentNote } = req.body || {};
  if (!['approved', 'rejected', 'fulfilled'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approved, rejected, or fulfilled' });
  }
  const r = db.prepare('SELECT * FROM redemptions WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Redemption not found' });
  const kid = db.prepare('SELECT * FROM users WHERE id = ? AND family_id = ?').get(r.kid_id, req.user.familyId);
  if (!kid) return res.status(404).json({ error: 'Redemption not found' });

  if (decision === 'approved') {
    if (r.status !== 'pending') return res.status(409).json({ error: 'Redemption already resolved' });
    if (kid.total_xp < r.xp_cost) return res.status(400).json({ error: 'Kid no longer has enough XP for this reward' });
    applyXpTransaction({ kidId: kid.id, amount: -r.xp_cost, type: 'redemption', sourceId: r.reward_id, note: 'Reward redeemed' });
  } else if (decision === 'fulfilled' && r.status !== 'approved') {
    return res.status(409).json({ error: 'Redemption must be approved before it can be fulfilled' });
  } else if (decision === 'rejected' && r.status !== 'pending') {
    return res.status(409).json({ error: 'Only pending redemptions can be rejected' });
  }

  db.prepare(`UPDATE redemptions SET status = ?, parent_note = ?, resolved_at = ? WHERE id = ?`)
    .run(decision, parentNote || r.parent_note || null, new Date().toISOString(), r.id);

  const updated = db.prepare('SELECT * FROM redemptions WHERE id = ?').get(r.id);
  res.json({ redemption: shape(updated) });
});

export default router;
