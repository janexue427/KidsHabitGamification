import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../api/client.js';

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
  const [boostForm, setBoostForm] = useState({ kidId: '', amount: '', note: '' });
  const [boostStatus, setBoostStatus] = useState('');

  async function loadDashboard() {
    const d = await api.get('/dashboard');
    setData(d);
    if (d.kids.length && !boostForm.kidId) setBoostForm((f) => ({ ...f, kidId: d.kids[0].id }));
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

  async function sendBoost(e) {
    e.preventDefault();
    setBoostStatus('');
    try {
      await api.post('/xp/boost', { kidId: boostForm.kidId, amount: Number(boostForm.amount), note: boostForm.note });
      setBoostStatus('sent');
      setBoostForm((f) => ({ ...f, amount: '', note: '' }));
      loadDashboard();
    } catch (err) {
      setBoostStatus(err.message);
    }
  }

  if (!data) return <p className="text-gray-400">Loading dashboard…</p>;

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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-fun text-xl font-bold text-kid-purple">XP Trend</h2>
          <div className="flex gap-2">
            <select value={selectedKid} onChange={(e) => setSelectedKid(e.target.value)} className="text-sm border rounded-lg px-2 py-1">
              <option value="all">All kids</option>
              {data.kids.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1 rounded-full text-sm font-semibold ${period === p.key ? 'bg-kid-purple text-white' : 'bg-gray-100 text-gray-500'}`}
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
                <XAxis dataKey="key" tick={{ fontSize: 11 }} />
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
          <h2 className="font-fun text-lg font-bold text-kid-purple mb-3">Send an XP Boost ⚡</h2>
          <form onSubmit={sendBoost} className="space-y-3">
            <select
              value={boostForm.kidId}
              onChange={(e) => setBoostForm((f) => ({ ...f, kidId: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {data.kids.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              required
              placeholder="XP amount"
              value={boostForm.amount}
              onChange={(e) => setBoostForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <input
              placeholder="Reason (optional)"
              value={boostForm.note}
              onChange={(e) => setBoostForm((f) => ({ ...f, note: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            {boostStatus === 'sent' && <p className="text-green-600 text-sm font-semibold">Boost sent! ⚡</p>}
            {boostStatus && boostStatus !== 'sent' && <p className="text-red-500 text-sm">{boostStatus}</p>}
            <button type="submit" disabled={!data.kids.length} className="w-full py-2 rounded-lg bg-kid-purple text-white font-semibold disabled:opacity-50">
              Send Boost
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow">
          <h2 className="font-fun text-lg font-bold text-kid-purple mb-3">Recent Activity</h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm border-b last:border-0 pb-2">
                <span>{a.kidAvatar} {a.kidName} — {a.note || a.type}</span>
                <span className={a.amount >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
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
