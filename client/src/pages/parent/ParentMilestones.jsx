import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const emptyForm = { title: '', description: '', icon: '🏆', kind: 'count', targetCount: 10, bonusXp: 50, kidIds: [] };

// Starting points for the kind of thing that happens away from the app.
const ACHIEVEMENT_IDEAS = [
  { title: 'Personal best in swimming', icon: '🏊', bonusXp: 150 },
  { title: 'New personal best chess rating', icon: '♟️', bonusXp: 150 },
  { title: 'Finish an opening course', icon: '📘', bonusXp: 200 },
  { title: 'Read a whole chapter book', icon: '📚', bonusXp: 150 },
  { title: 'Learn a new piece by heart', icon: '🎼', bonusXp: 150 },
];

export default function ParentMilestones() {
  const [milestones, setMilestones] = useState([]);
  const [kids, setKids] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function load() {
    const [m, k] = await Promise.all([api.get('/milestones'), api.get('/auth/kids')]);
    setMilestones(m.milestones);
    setKids(k.kids);
  }

  useEffect(() => {
    load();
  }, []);

  function toggleKid(id) {
    setForm((f) => ({
      ...f,
      kidIds: f.kidIds.includes(id) ? f.kidIds.filter((k) => k !== id) : [...f.kidIds, id],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/milestones', {
        ...form,
        targetCount: form.kind === 'achievement' ? 1 : Number(form.targetCount),
        bonusXp: Number(form.bonusXp),
      });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(m) {
    if (!confirm(`Delete "${m.title}"?`)) return;
    await api.del(`/milestones/${m.id}`);
    load();
  }

  function kidName(id) {
    return kids.find((k) => k.id === id)?.name || '?';
  }

  async function markReached(m, kidId, reached) {
    setError('');
    try {
      await api.post(`/milestones/${m.id}/${reached ? 'achieve' : 'unachieve'}`, { kidId });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h2 className="font-fun text-2xl font-bold text-kid-purple mb-4">Milestones</h2>
        <div className="space-y-3">
          {milestones.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl p-4 shadow">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-2xl shrink-0">{m.icon}</span>
                  <div className="min-w-0">
                    <p className="font-fun font-bold">{m.title}</p>
                    <p className="text-xs text-gray-400">
                      {m.kind === 'achievement' ? 'one-off achievement' : `${m.targetCount} tasks`} · +{m.bonusXp} XP bonus
                    </p>
                  </div>
                </div>
                <button onClick={() => remove(m)} className="text-xs bg-red-50 text-red-600 px-3 min-h-[40px] shrink-0 rounded-lg">
                  Delete
                </button>
              </div>
              <div className="space-y-2">
                {m.assignments.map((a) =>
                  m.kind === 'achievement' ? (
                    <div key={a.kidId} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-600 min-w-0 truncate">
                        {kidName(a.kidId)} {a.completedAt ? '— reached 🎉' : '— not yet'}
                      </span>
                      <button
                        onClick={() => markReached(m, a.kidId, !a.completedAt)}
                        className={`text-xs px-3 min-h-[40px] rounded-lg font-semibold shrink-0 ${
                          a.completedAt ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {a.completedAt ? 'Undo' : `Reached — award ${m.bonusXp} XP`}
                      </button>
                    </div>
                  ) : (
                    <p key={a.kidId} className="text-xs text-gray-500">
                      {kidName(a.kidId)}: {a.progress}/{m.targetCount} {a.completedAt ? '✅' : ''}
                    </p>
                  )
                )}
              </div>
            </div>
          ))}
          {milestones.length === 0 && <p className="text-gray-400 text-sm">No milestones yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow h-fit">
        <h3 className="font-fun font-bold text-lg mb-3">New Milestone</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2">
            {[
              { key: 'count', label: 'Counts quests' },
              { key: 'achievement', label: 'One-off achievement' },
            ].map((k) => (
              <button
                type="button"
                key={k.key}
                onClick={() => setForm((f) => ({ ...f, kind: k.key }))}
                aria-pressed={form.kind === k.key}
                className={`flex-1 min-h-[48px] rounded-xl font-semibold text-xs ${
                  form.kind === k.key ? 'bg-kid-purple text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>

          {form.kind === 'achievement' && (
            <div className="flex flex-wrap gap-1">
              {ACHIEVEMENT_IDEAS.map((a) => (
                <button
                  key={a.title}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, title: a.title, icon: a.icon, bonusXp: a.bonusXp }))}
                  className="text-xs bg-kid-teal/10 text-kid-teal px-3 min-h-[40px] rounded-lg"
                >
                  {a.icon} {a.title}
                </button>
              ))}
            </div>
          )}

          <input required placeholder="Title (e.g. Chore Champion)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm" />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm" />
          <div className="flex gap-3">
            {form.kind === 'count' && (
              <label className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-gray-500">Tasks needed</span>
                <input type="number" min="1" required value={form.targetCount} onChange={(e) => setForm((f) => ({ ...f, targetCount: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm" />
              </label>
            )}
            <label className="flex-1 min-w-0">
              <span className="text-xs font-semibold text-gray-500">Bonus XP</span>
              <input type="number" min="1" required value={form.bonusXp} onChange={(e) => setForm((f) => ({ ...f, bonusXp: e.target.value }))} className="mt-1 w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm" />
            </label>
          </div>
          {form.kind === 'achievement' && (
            <p className="text-xs text-gray-400">
              You mark this one as reached when it happens — quests don't advance it.
            </p>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Assign to</p>
            <div className="flex flex-wrap gap-2">
              {kids.map((kid) => (
                <button
                  type="button"
                  key={kid.id}
                  onClick={() => toggleKid(kid.id)}
                  className={`px-3 min-h-[44px] rounded-lg text-sm ${form.kidIds.includes(kid.id) ? 'bg-kid-purple/20 ring-2 ring-kid-purple' : 'bg-gray-100'}`}
                >
                  {kid.avatar} {kid.name}
                </button>
              ))}
              {kids.length === 0 && <p className="text-xs text-gray-400">Add kids first.</p>}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full min-h-[48px] rounded-lg bg-kid-purple text-white font-semibold">
            Create Milestone
          </button>
        </form>
      </div>
    </div>
  );
}
