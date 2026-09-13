import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const categories = ['outing', 'family-time', 'treat', 'privilege'];
const emptyForm = { title: '', description: '', icon: '🎁', xpCost: 50, category: 'outing' };
const suggestions = [
  { title: 'Mommy and Me — 30 mins', icon: '👩‍👧', category: 'family-time', xpCost: 150,
    description: "Half an hour with Mum, doing whatever you choose" },
  { title: 'Daddy and Me — 30 mins', icon: '👨‍👦', category: 'family-time', xpCost: 150,
    description: "Half an hour with Dad, doing whatever you choose" },
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
  const [editingId, setEditingId] = useState(null);

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
          {rewards.map((r) =>
            editingId === r.id ? (
              <EditRewardCard
                key={r.id}
                reward={r}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  load();
                }}
              />
            ) : (
            <div key={r.id} className={`bg-white rounded-2xl p-4 shadow flex items-start justify-between gap-2 ${!r.active && 'opacity-50'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl shrink-0">{r.icon}</span>
                <div className="min-w-0">
                  <p className="font-fun font-bold">{r.title}</p>
                  <p className="text-xs text-gray-400">{r.xpCost} XP · {r.category}</p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => setEditingId(r.id)}
                  className="text-xs bg-kid-purple/10 text-kid-purple font-semibold px-3 min-h-[40px] rounded-lg"
                >
                  Edit
                </button>
                <button onClick={() => toggleActive(r)} className="text-xs bg-gray-100 px-3 min-h-[40px] rounded-lg">
                  {r.active ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => remove(r)} className="text-xs bg-red-50 text-red-600 px-3 min-h-[40px] rounded-lg">
                  Delete
                </button>
              </div>
            </div>
            )
          )}
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
              onClick={() =>
                setForm({
                  ...emptyForm,
                  title: s.title,
                  icon: s.icon,
                  category: s.category,
                  xpCost: s.xpCost ?? emptyForm.xpCost,
                  description: s.description ?? '',
                })
              }
              className="text-xs bg-kid-teal/10 text-kid-teal px-3 min-h-[40px] rounded-lg"
            >
              {s.icon} {s.title}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm" />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm" />
          <div className="flex gap-3">
            <input placeholder="Icon" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className="w-16 shrink-0 border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm text-center" />
            <input type="number" min="1" required placeholder="XP cost" value={form.xpCost} onChange={(e) => setForm((f) => ({ ...f, xpCost: e.target.value }))} className="flex-1 min-w-0 border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm" />
          </div>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm">
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full min-h-[48px] rounded-lg bg-kid-purple text-white font-semibold">
            Add Reward
          </button>
        </form>
      </div>
    </div>
  );
}

/** Inline reward editor, seeded from the reward so untouched fields stay put. */
function EditRewardCard({ reward, onCancel, onSaved }) {
  const [form, setForm] = useState({
    title: reward.title,
    description: reward.description || '',
    icon: reward.icon,
    xpCost: reward.xpCost,
    category: reward.category,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.put(`/rewards/${reward.id}`, { ...form, xpCost: Number(form.xpCost) });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-2xl p-4 shadow ring-2 ring-kid-purple space-y-3">
      <p className="font-fun font-bold text-sm text-kid-purple">Editing reward</p>
      <input
        required
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
      />
      <input
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
      />
      <div className="flex gap-3">
        <input
          aria-label="Icon"
          value={form.icon}
          onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
          className="w-16 shrink-0 border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm text-center"
        />
        <input
          type="number"
          min="1"
          required
          aria-label="XP cost"
          value={form.xpCost}
          onChange={(e) => setForm((f) => ({ ...f, xpCost: e.target.value }))}
          className="flex-1 min-w-0 border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
        />
      </div>
      <select
        value={form.category}
        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
      >
        {categories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 min-h-[48px] rounded-lg bg-kid-purple text-white font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 min-h-[48px] rounded-lg bg-gray-100 font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}
