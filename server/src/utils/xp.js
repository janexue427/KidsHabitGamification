import { nanoid } from 'nanoid';
import db from '../db.js';

// Central ledger writer: every XP change (earn or spend) goes through here
// so xp_transactions stays the single source of truth for totals and trends.
export function applyXpTransaction({ kidId, amount, type, sourceId = null, note = null }) {
  const now = new Date().toISOString();
  const insert = db.prepare(`
    INSERT INTO xp_transactions (id, kid_id, amount, type, source_id, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateTotal = db.prepare(`UPDATE users SET total_xp = total_xp + ? WHERE id = ?`);

  const tx = db.transaction(() => {
    const id = nanoid();
    insert.run(id, kidId, amount, type, sourceId, note, now);
    updateTotal.run(amount, kidId);
    return id;
  });

  return tx();
}
