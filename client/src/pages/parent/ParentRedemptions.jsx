import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export default function ParentRedemptions() {
  const [redemptions, setRedemptions] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState('');

  async function load() {
    const data = await api.get(`/redemptions?status=${filter}`);
    setRedemptions(data.redemptions);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function resolve(r, decision) {
    setError('');
    try {
      await api.post(`/redemptions/${r.id}/resolve`, { decision });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-fun text-2xl font-bold text-kid-purple">Redemption Requests</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-base fine:text-sm border rounded-lg px-3 min-h-[44px]">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="space-y-3">
        {redemptions.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl p-4 shadow flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl shrink-0">{r.reward?.icon}</span>
              <div className="min-w-0">
                <p className="font-fun font-bold">{r.reward?.title}</p>
                <p className="text-xs text-gray-400">{r.kid?.avatar} {r.kid?.name} · {r.xpCost} XP</p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              {r.status === 'pending' && (
                <>
                  <button onClick={() => resolve(r, 'approved')} className="flex-1 sm:flex-none text-xs bg-green-100 text-green-700 px-4 min-h-[44px] rounded-lg font-semibold">
                    Approve
                  </button>
                  <button onClick={() => resolve(r, 'rejected')} className="flex-1 sm:flex-none text-xs bg-red-100 text-red-600 px-4 min-h-[44px] rounded-lg font-semibold">
                    Reject
                  </button>
                </>
              )}
              {r.status === 'approved' && (
                <button onClick={() => resolve(r, 'fulfilled')} className="flex-1 sm:flex-none text-xs bg-blue-100 text-blue-700 px-4 min-h-[44px] rounded-lg font-semibold">
                  Mark Fulfilled
                </button>
              )}
              {(r.status === 'fulfilled' || r.status === 'rejected') && (
                <span className="text-xs text-gray-400 capitalize">{r.status}</span>
              )}
            </div>
          </div>
        ))}
        {redemptions.length === 0 && <p className="text-gray-400 text-sm">Nothing here.</p>}
      </div>
    </div>
  );
}
