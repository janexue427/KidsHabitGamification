import { Router } from 'express';
import db from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { applyXpTransaction } from '../utils/xp.js';

const router = Router();

function isoWeekKey(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function bucketKey(dateStr, period) {
  const d = new Date(dateStr);
  if (period === 'day') return dateStr.slice(0, 10);
  if (period === 'week') return isoWeekKey(d);
  return dateStr.slice(0, 7); // month: YYYY-MM
}

function buildSeries(kidId, period) {
  const days = period === 'day' ? 14 : period === 'week' ? 84 : 365;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = db.prepare(`
    SELECT amount, type, created_at FROM xp_transactions
    WHERE kid_id = ? AND created_at >= ?
    ORDER BY created_at ASC
  `).all(kidId, since);

  const buckets = new Map();
  for (const row of rows) {
    const key = bucketKey(row.created_at, period);
    buckets.set(key, (buckets.get(key) || 0) + row.amount);
  }
  return Array.from(buckets.entries()).map(([key, amount]) => ({ key, amount }));
}

// GET /api/xp/history?period=day|week|month&kidId=<id, parent only>
router.get('/history', requireAuth, (req, res) => {
  const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'day';
  let kidId = req.user.role === 'kid' ? req.user.id : req.query.kidId;
  if (!kidId) return res.status(400).json({ error: 'kidId is required' });
  if (req.user.role === 'parent') {
    const kid = db.prepare("SELECT id FROM users WHERE id = ? AND family_id = ? AND role = 'kid'").get(kidId, req.user.familyId);
    if (!kid) return res.status(404).json({ error: 'Kid not found' });
  }
  res.json({ period, series: buildSeries(kidId, period) });
});

// GET /api/xp/transactions/mine - raw recent ledger for a kid
router.get('/transactions/mine', requireAuth, requireRole('kid'), (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM xp_transactions WHERE kid_id = ? ORDER BY created_at DESC LIMIT 50
  `).all(req.user.id);
  res.json({ transactions: rows });
});

// Parent: send a bonus XP boost to a kid.
router.post('/boost', requireAuth, requireRole('parent'), (req, res) => {
  const { kidId, amount, note } = req.body || {};
  if (!kidId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'kidId and a positive amount are required' });
  }
  const kid = db.prepare("SELECT * FROM users WHERE id = ? AND family_id = ? AND role = 'kid'").get(kidId, req.user.familyId);
  if (!kid) return res.status(404).json({ error: 'Kid not found' });

  applyXpTransaction({ kidId, amount: Math.round(Number(amount)), type: 'boost', note: note || 'XP boost from parent' });
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(kidId);
  res.json({ ok: true, totalXp: updated.total_xp });
});

export default router;
