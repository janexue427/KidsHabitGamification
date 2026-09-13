import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { difficultyFor } from '../../constants/difficulty.js';

const FILTERS = [
  { key: 'unverified', label: 'To check' },
  { key: 'verified', label: 'Checked' },
  { key: 'all', label: 'All' },
];

export default function ParentCompletions() {
  const [completions, setCompletions] = useState([]);
  const [filter, setFilter] = useState('unverified');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    const data = await api.get(`/tasks/completions?status=${filter}`);
    setCompletions(data.completions);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function verify(c, verified) {
    setBusy(c.id);
    setError('');
    try {
      await api.post(`/tasks/completions/${c.id}/verify`, { verified });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function reset(c) {
    const warning =
      `Reset "${c.title}" for ${c.kidName}?\n\n` +
      `This marks it not done again and takes back ${c.xpAwarded} XP. ` +
      `If it was the only quest finished that day, a streak bonus earned then is also reversed.`;
    if (!confirm(warning)) return;
    setBusy(c.id);
    setError('');
    try {
      const res = await api.del(`/tasks/completions/${c.id}`);
      setNotice(
        `Reset. ${res.xpReversed} XP taken back` +
          (res.streakBonusRevoked ? `, plus a ${res.streakBonusRevoked} XP streak bonus.` : '.')
      );
      setTimeout(() => setNotice(''), 6000);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const dayLabel = (d) => {
    if (d === today) return 'Today';
    const diff = Math.round((new Date(d) - new Date(today)) / 86400000);
    if (diff === -1) return 'Yesterday';
    if (diff > 0) return `${diff} day${diff === 1 ? '' : 's'} ahead`;
    return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-fun text-2xl font-bold text-kid-purple">Quest Check</h2>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`px-4 min-h-[44px] rounded-full text-sm font-semibold ${
                filter === f.key ? 'bg-kid-purple text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Confirm what your kids have finished, or reset anything that was ticked off too eagerly.
      </p>

      {notice && (
        <p role="status" className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl px-4 py-3">
          {notice}
        </p>
      )}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="space-y-3">
        {completions.map((c) => {
          const felt = difficultyFor(c.difficulty);
          return (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{c.icon}</span>
                  <div className="min-w-0">
                    <p className="font-fun font-bold break-words">{c.title}</p>
                    <p className="text-xs text-gray-400">
                      {c.kidAvatar} {c.kidName} · {dayLabel(c.date)} · +{c.xpAwarded} XP
                      {felt && (
                        <span title={`Felt: ${felt.label}`} className="ml-1">{felt.emoji}</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  {c.verified ? (
                    <button
                      disabled={busy === c.id}
                      onClick={() => verify(c, false)}
                      className="flex-1 sm:flex-none text-xs bg-green-100 text-green-700 px-4 min-h-[44px] rounded-lg font-semibold disabled:opacity-50"
                    >
                      Checked ✓ — undo
                    </button>
                  ) : (
                    <button
                      disabled={busy === c.id}
                      onClick={() => verify(c, true)}
                      className="flex-1 sm:flex-none text-xs bg-green-100 text-green-700 px-4 min-h-[44px] rounded-lg font-semibold disabled:opacity-50"
                    >
                      Looks good ✓
                    </button>
                  )}
                  <button
                    disabled={busy === c.id}
                    onClick={() => reset(c)}
                    className="flex-1 sm:flex-none text-xs bg-red-50 text-red-600 px-4 min-h-[44px] rounded-lg font-semibold disabled:opacity-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {completions.length === 0 && (
          <p className="text-gray-400 text-sm">
            {filter === 'unverified' ? 'Nothing waiting to be checked.' : 'Nothing here.'}
          </p>
        )}
      </div>
    </div>
  );
}
