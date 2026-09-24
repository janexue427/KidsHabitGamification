import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../api/client.js';
import { difficultyFor } from '../../constants/difficulty.js';

const periods = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

export default function ParentDashboard() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('day');
  const [selectedKid, setSelectedKid] = useState('all');
  const [series, setSeries] = useState([]);
  // One form for both directions of a manual XP change. Which way it goes is a
  // deliberate choice the parent makes, never a sign typed into the amount.
  const [adjust, setAdjust] = useState({ mode: 'boost', kidId: '', amount: '', note: '' });
  const [adjustStatus, setAdjustStatus] = useState(null);

  async function loadDashboard() {
    const d = await api.get('/dashboard');
    setData(d);
    if (d.kids.length && !adjust.kidId) setAdjust((f) => ({ ...f, kidId: d.kids[0].id }));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!data) return;
    (async () => {
      if (selectedKid === 'all') {
        const all = await Promise.all(data.kids.map((k) => api.get(`/xp/history?period=${period}&kidId=${k.id}`)));
        const merged = new Map();
        for (const res of all) {
          for (const point of res.series) merged.set(point.key, (merged.get(point.key) || 0) + point.amount);
        }
        setSeries(Array.from(merged.entries()).map(([key, amount]) => ({ key, amount })).sort((a, b) => a.key.localeCompare(b.key)));
      } else {
        const res = await api.get(`/xp/history?period=${period}&kidId=${selectedKid}`);
        setSeries(res.series);
      }
    })();
  }, [data, period, selectedKid]);

  function setMode(mode) {
    // Drop the old confirmation too: "Boost sent!" left sitting above a penalty
    // form reads as though the penalty is what went through.
    setAdjustStatus(null);
    setAdjust((f) => ({ ...f, mode }));
  }

  async function submitAdjust(e) {
    e.preventDefault();
    setAdjustStatus(null);
    const isPenalty = adjust.mode === 'penalty';
    const kidName = data.kids.find((k) => k.id === adjust.kidId)?.name || 'they';

    if (isPenalty && !adjust.note.trim()) {
      setAdjustStatus({ ok: false, message: 'Add a reason, so they know what the penalty is for.' });
      return;
    }

    try {
      const res = await api.post(isPenalty ? '/xp/penalty' : '/xp/boost', {
        kidId: adjust.kidId,
        amount: Number(adjust.amount),
        note: adjust.note,
      });
      setAdjustStatus({
        ok: true,
        message: !isPenalty
          ? 'Boost sent! \u26a1'
          : res.clamped
            // The server stops at zero rather than running a kid into debt, so
            // say plainly that less came off than was asked for.
            ? `Took away ${res.applied} XP \u2014 that was all ${kidName} had left.`
            : `Took ${res.applied} XP away from ${kidName}.`,
      });
      setAdjust((f) => ({ ...f, amount: '', note: '' }));
      loadDashboard();
    } catch (err) {
      setAdjustStatus({ ok: false, message: err.message });
    }
  }

  if (!data) return <p className="text-gray-400">Loading dashboard…</p>;

  const isPenalty = adjust.mode === 'penalty';

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.kids.map((kid) => (
          <div key={kid.id} className="bg-white rounded-2xl p-4 shadow">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{kid.avatar}</span>
              <p className="font-fun font-bold">{kid.name}</p>
            </div>
            <p className="text-2xl font-extrabold text-kid-purple">{kid.totalXp} <span className="text-sm font-normal text-gray-400">XP</span></p>
            <p className="text-xs text-gray-500 mt-1">🔥 {kid.streak} day streak · {kid.tasksThisWeek} quests this week</p>
            {(kid.pendingSuggestions > 0 || kid.pendingRedemptions > 0) && (
              <p className="text-xs text-kid-orange font-semibold mt-1">
                {kid.pendingSuggestions > 0 && `${kid.pendingSuggestions} suggestion(s) `}
                {kid.pendingRedemptions > 0 && `${kid.pendingRedemptions} redemption(s)`} pending
              </p>
            )}
          </div>
        ))}
        {data.kids.length === 0 && (
          <p className="text-gray-500 col-span-4 text-center py-6 bg-white rounded-2xl shadow">
            No kids yet — add one from the Kids tab.
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="font-fun text-xl font-bold text-kid-purple">XP Trend</h2>
          <div className="flex flex-wrap gap-2 items-center">
            <select value={selectedKid} onChange={(e) => setSelectedKid(e.target.value)} className="text-base fine:text-sm border rounded-lg px-3 min-h-[44px] w-full sm:w-auto">
              <option value="all">All kids</option>
              {data.kids.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 min-h-[44px] rounded-full text-sm font-semibold ${period === p.key ? 'bg-kid-purple text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-64">
          {series.length === 0 ? (
            <p className="text-center text-gray-400 pt-20">No XP activity yet for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="pxpGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="amount" stroke="#14b8a6" fill="url(#pxpGradient)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-4 shadow">
          <h2 className="font-fun text-lg font-bold text-kid-purple mb-3">Adjust XP</h2>

          <div role="group" aria-label="Direction of the XP change" className="flex gap-2 mb-3">
            {[
              { key: 'boost', label: 'Give a boost ⚡', on: 'bg-kid-purple text-white' },
              { key: 'penalty', label: 'Take XP away ➖', on: 'bg-red-500 text-white' },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                aria-pressed={adjust.mode === m.key}
                className={`flex-1 min-h-[44px] rounded-lg text-sm font-semibold ${
                  adjust.mode === m.key ? m.on : 'bg-gray-100 text-gray-500'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <form onSubmit={submitAdjust} className="space-y-3">
            <select
              value={adjust.kidId}
              onChange={(e) => setAdjust((f) => ({ ...f, kidId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
            >
              {data.kids.map((k) => (
                <option key={k.id} value={k.id}>{k.name} · {k.totalXp} XP</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              required
              placeholder={isPenalty ? 'XP to take away' : 'XP amount'}
              value={adjust.amount}
              onChange={(e) => setAdjust((f) => ({ ...f, amount: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
            />
            <input
              required={isPenalty}
              placeholder={isPenalty ? 'Reason (required — they will see it)' : 'Reason (optional)'}
              value={adjust.note}
              onChange={(e) => setAdjust((f) => ({ ...f, note: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
            />
            {isPenalty && (
              <p className="text-xs text-gray-400">
                XP never drops below zero — a penalty bigger than their balance just empties it.
              </p>
            )}
            {adjustStatus && (
              <p
                role="status"
                className={`text-sm font-semibold ${adjustStatus.ok ? 'text-green-600' : 'text-red-500'}`}
              >
                {adjustStatus.message}
              </p>
            )}
            <button
              type="submit"
              disabled={!data.kids.length}
              className={`w-full min-h-[48px] rounded-lg text-white font-semibold disabled:opacity-50 ${
                isPenalty ? 'bg-red-500' : 'bg-kid-purple'
              }`}
            >
              {isPenalty ? 'Take XP Away' : 'Send Boost'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow">
          <h2 className="font-fun text-lg font-bold text-kid-purple mb-3">Recent Activity</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 text-sm border-b last:border-0 pb-2">
                <span className="min-w-0 break-words">
                  {a.kidAvatar} {a.kidName} — {a.note || a.type}
                  {difficultyFor(a.difficulty) && (
                    <span
                      className="ml-1"
                      title={`Felt: ${difficultyFor(a.difficulty).label}`}
                      aria-label={`Felt: ${difficultyFor(a.difficulty).label}`}
                    >
                      {difficultyFor(a.difficulty).emoji}
                    </span>
                  )}
                </span>
                <span className={`shrink-0 whitespace-nowrap ${a.amount >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}`}>
                  {a.amount >= 0 ? '+' : ''}{a.amount} XP
                </span>
              </div>
            ))}
            {data.activity.length === 0 && <p className="text-gray-400 text-sm">No activity yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
