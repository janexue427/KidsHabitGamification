import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../api/client.js';

const periods = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

export default function KidHistory() {
  const [period, setPeriod] = useState('day');
  const [series, setSeries] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/xp/history?period=${period}`).then((data) => {
      setSeries(data.series);
      setLoading(false);
    });
  }, [period]);

  useEffect(() => {
    api.get('/xp/transactions/mine').then((data) => setTransactions(data.transactions));
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="font-fun text-2xl font-bold text-kid-purple">My XP Journey</h2>

      <div className="flex gap-2">
        {periods.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-full text-sm font-semibold ${
              period === p.key ? 'bg-kid-purple text-white' : 'bg-white text-gray-500'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow h-64">
        {loading ? (
          <p className="text-center text-gray-400 pt-20">Loading chart…</p>
        ) : series.length === 0 ? (
          <p className="text-center text-gray-400 pt-20">Complete some quests to see your trend!</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="key" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="amount" stroke="#7c3aed" fill="url(#xpGradient)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <section>
        <h3 className="font-fun text-lg font-bold text-kid-purple mb-2">Recent Activity</h3>
        <div className="space-y-2">
          {transactions.map((t) => (
            <div key={t.id} className="bg-white rounded-xl px-4 py-3 shadow flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold">{t.note || labelForType(t.type)}</p>
                <p className="text-xs text-gray-400">{new Date(t.created_at).toLocaleString()}</p>
              </div>
              <span className={`font-fun font-bold ${t.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {t.amount >= 0 ? '+' : ''}
                {t.amount} XP
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function labelForType(type) {
  return { task: 'Quest completed', milestone: 'Milestone bonus', boost: 'XP boost', redemption: 'Reward redeemed' }[type] || type;
}
