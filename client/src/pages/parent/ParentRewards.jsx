import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const categories = ['outing', 'family-time', 'treat', 'privilege'];
const emptyForm = { title: '', description: '', icon: '🎁', xpCost: 50, category: 'outing' };
const suggestions = [
  { title: 'Movie Night Pick', icon: '🎬', category: 'family-time' },
  { title: 'Trip to the Park', icon: '🌳', category: 'outing' },
  { title: 'Ice Cream Outing', icon: '🍦', category: 'treat' },
  { title: 'Stay Up 30 Min Late', icon: '🌙', category: 'privilege' },
  { title: 'Choose Family Dinner', icon: '🍕', category: 'privilege' },
  { title: 'Game Night with Family', icon: '🎲', category: 'family-time' },
];

export default function ParentRewards() {
  const [rewards, setRewards] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function load() {
    const data = await api.get('/rewards');
    setRewards(data.rewards);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/rewards', { ...form, xpCost: Number(form.xpCost) });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(r) {
    await api.put(`/rewards/${r.id}`, { active: !r.active });
    load();
  }

  async function remove(r) {
    if (!confirm(`Delete "${r.title}"?`)) return;
    await api.del(`/rewards/${r.id}`);
    load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h2 className="font-fun text-2xl font-bold text-kid-purple mb-4">Reward Catalog</h2>
        <div className="space-y-3">
          {rewards.map((r) => (
            <div key={r.id} className={`bg-white rounded-2xl p-4 shadow flex items-center justify-between ${!r.active && 'opacity-50'}`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{r.icon}</span>
                <div>
                  <p className="font-fun font-bold">{r.title}</p>
                  <p className="text-xs text-gray-400">{r.xpCost} XP · {r.category}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggleActive(r)} className="text-xs bg-gray-100 px-2 py-1 rounded-lg">
                  {r.active ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => remove(r)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg">
                  Delete
                </button>
              </div>
            </div>
          ))}
          {rewards.length === 0 && <p className="text-gray-400 text-sm">No rewards yet — add some below!</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow h-fit">
        <h3 className="font-fun font-bold text-lg mb-3">New Reward</h3>
        <div className="flex flex-wrap gap-1 mb-3">
          {suggestions.map((s) => (
            <button
              key={s.title}
              type="button"
              onClick={() => setForm({ ...emptyForm, title: s.title, icon: s.icon, category: s.category })}
              className="text-xs bg-kid-teal/10 text-kid-teal px-2 py-1 rounded-lg"
            >
              {s.icon} {s.title}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-3">
            <input placeholder="Icon" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className="w-16 border rounded-lg px-3 py-2 text-sm text-center" />
            <input type="number" min="1" required placeholder="XP cost" value={form.xpCost} onChange={(e) => setForm((f) => ({ ...f, xpCost: e.target.value }))} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          </div>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full py-2 rounded-lg bg-kid-purple text-white font-semibold">
            Add Reward
          </button>
        </form>
      </div>
    </div>
  );
}
