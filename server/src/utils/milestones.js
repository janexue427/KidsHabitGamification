import db from '../db.js';
import { applyXpTransaction } from './xp.js';

// Called whenever a kid completes a task: advances progress on every active
// milestone assigned to them, awarding the bonus XP the moment one is reached.
export function advanceMilestonesForKid(kidId) {
  // Only counting milestones advance with quests. An achievement stands for
  // something that happened away from the app — a personal best, a book
  // finished — and a parent marks it; letting a quest tick it along would hand
  // out the bonus for unrelated work.
  const assignments = db.prepare(`
    SELECT ma.*, m.target_count, m.bonus_xp, m.title, m.active
    FROM milestone_assignments ma
    JOIN milestones m ON m.id = ma.milestone_id
    WHERE ma.kid_id = ? AND m.active = 1 AND ma.completed_at IS NULL
      AND COALESCE(m.kind, 'count') = 'count'
  `).all(kidId);

  const completed = [];
  for (const a of assignments) {
    const newProgress = a.progress + 1;
    const isDone = newProgress >= a.target_count;
    db.prepare(`
      UPDATE milestone_assignments SET progress = ?, completed_at = ?
      WHERE milestone_id = ? AND kid_id = ?
    `).run(newProgress, isDone ? new Date().toISOString() : null, a.milestone_id, kidId);

    if (isDone) {
      applyXpTransaction({ kidId, amount: a.bonus_xp, type: 'milestone', sourceId: a.milestone_id, note: a.title });
      completed.push({ milestoneId: a.milestone_id, title: a.title, bonusXp: a.bonus_xp });
    }
  }
  return completed;
}
