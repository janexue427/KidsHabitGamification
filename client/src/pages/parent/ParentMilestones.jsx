import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const emptyForm = { title: '', description: '', icon: '🏆', targetCount: 10, bonusXp: 50, kidIds: [] };

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
      await api.post('/milestones', { ...form, targetCount: Number(form.targetCount), bonusXp: Number(form.bonusXp) });
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h2 className="font-fun text-2xl font-bold text-kid-purple mb-4">Milestones</h2>
        <div className="space-y-3">
          {milestones.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl p-4 shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{m.icon}</span>
                  <div>
                    <p className="font-fun font-bold">{m.title}</p>
                    <p className="text-xs text-gray-400">{m.targetCount} tasks · +{m.bonusXp} XP bonus</p>
                  </div>
                </div>
                <button onClick={() => remove(m)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg">
                  Delete
                </button>
              </div>
              <div className="space-y-1">
                {m.assignments.map((a) => (
                  <p key={a.kidId} className="text-xs text-gray-500">
                    {kidName(a.kidId)}: {a.progress}/{m.targetCount} {a.completedAt ? '✅' : ''}
                  </p>
                ))}
              </div>
            </div>
          ))}
          {milestones.length === 0 && <p className="text-gray-400 text-sm">No milestones yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow h-fit">
        <h3 className="font-fun font-bold text-lg mb-3">New Milestone</h3>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Title (e.g. Chore Champion)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-3">
            <input type="number" min="1" required placeholder="Tasks needed" value={form.targetCount} onChange={(e) => setForm((f) => ({ ...f, targetCount: e.target.value }))} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            <input type="number" min="1" required placeholder="Bonus XP" value={form.bonusXp} onChange={(e) => setForm((f) => ({ ...f, bonusXp: e.target.value }))} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Assign to</p>
            <div className="flex flex-wrap gap-2">
              {kids.map((kid) => (
                <button
                  type="button"
                  key={kid.id}
                  onClick={() => toggleKid(kid.id)}
                  className={`px-2 py-1 rounded-lg text-sm ${form.kidIds.includes(kid.id) ? 'bg-kid-purple/20 ring-2 ring-kid-purple' : 'bg-gray-100'}`}
                >
                  {kid.avatar} {kid.name}
                </button>
              ))}
              {kids.length === 0 && <p className="text-xs text-gray-400">Add kids first.</p>}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full py-2 rounded-lg bg-kid-purple text-white font-semibold">
            Create Milestone
          </button>
        </form>
      </div>
    </div>
  );
}
