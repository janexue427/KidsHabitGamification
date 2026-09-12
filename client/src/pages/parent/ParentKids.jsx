import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const avatars = ['🦁', '🐯', '🐼', '🦊', '🐸', '🦄', '🐵', '🐨', '🐰', '🐲'];

export default function ParentKids() {
  const [kids, setKids] = useState([]);
  const [form, setForm] = useState({ name: '', username: '', pin: '', avatar: avatars[0] });
  const [error, setError] = useState('');

  async function load() {
    const data = await api.get('/auth/kids');
    setKids(data.kids);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/kids', form);
      setForm({ name: '', username: '', pin: '', avatar: avatars[0] });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-fun text-2xl font-bold text-kid-purple">Kids</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {kids.map((kid) => (
          <div key={kid.id} className="bg-white rounded-2xl p-4 shadow flex items-center gap-3 min-w-0">
            <span className="text-3xl shrink-0">{kid.avatar}</span>
            <div className="min-w-0">
              <p className="font-fun font-bold">{kid.name}</p>
              <p className="text-xs text-gray-400 truncate">@{kid.username} · {kid.totalXp} XP</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow max-w-md">
        <h3 className="font-fun font-bold text-lg mb-3">Add a kid</h3>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {avatars.map((a) => (
              <button
                type="button"
                key={a}
                onClick={() => setForm((f) => ({ ...f, avatar: a }))}
                className={`text-2xl w-12 h-12 flex items-center justify-center rounded-lg ${form.avatar === a ? 'bg-kid-purple/20 ring-2 ring-kid-purple' : ''}`}
              >
                {a}
              </button>
            ))}
          </div>
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
          <input
            required
            placeholder="Username (for kid login)"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
          <input
            required
            placeholder="PIN"
            inputMode="numeric"
            value={form.pin}
            onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full min-h-[48px] rounded-lg bg-kid-purple text-white font-semibold">
            Add Kid
          </button>
        </form>
      </div>
    </div>
  );
}
