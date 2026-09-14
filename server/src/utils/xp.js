import { nanoid } from 'nanoid';
import db from '../db.js';

/**
 * Write one XP movement and move the running total.
 *
 * Opens no transaction of its own, so it can be used inside a larger one.
 * libsql, unlike better-sqlite3, does not nest transactions via savepoints —
 * calling a self-transacting helper from inside a transaction fails outright.
 */
export function recordXp({ kidId, amount, type, sourceId = null, note = null, completionId = null }) {
  const id = nanoid();
  db.prepare(`
    INSERT INTO xp_transactions (id, kid_id, amount, type, source_id, completion_id, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, kidId, amount, type, sourceId, completionId, note, new Date().toISOString());
  db.prepare('UPDATE users SET total_xp = total_xp + ? WHERE id = ?').run(amount, kidId);
  return id;
}

/**
 * Central ledger writer: every XP change (earn or spend) goes through here so
 * xp_transactions stays the single source of truth for totals and trends.
 * Use recordXp instead when the caller already holds a transaction.
 */
export function applyXpTransaction(args) {
  return db.transaction(() => recordXp(args))();
}
