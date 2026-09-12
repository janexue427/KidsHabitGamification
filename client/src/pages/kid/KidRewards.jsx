import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function KidRewards() {
  const [rewards, setRewards] = useState([]);
  const [myRedemptions, setMyRedemptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  async function load() {
    const [r, mine] = await Promise.all([api.get('/rewards'), api.get('/redemptions/mine')]);
    setRewards(r.rewards);
    setMyRedemptions(mine.redemptions);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function redeem(reward) {
    try {
      await api.post('/redemptions', { rewardId: reward.id });
      alert(`Request sent! Ask a parent to approve your ${reward.title} 🎉`);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <p className="text-center text-gray-400 py-10">Loading rewards…</p>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-4 shadow flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-fun text-2xl font-bold text-kid-purple">Reward Shop</h2>
        <span className="font-fun text-xl font-extrabold text-kid-orange">{user?.totalXp ?? 0} XP</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rewards.map((r) => {
          const affordable = (user?.totalXp ?? 0) >= r.xpCost;
          return (
            <div key={r.id} className="bg-white rounded-2xl p-4 shadow flex flex-col">
              <div className="text-4xl mb-2">{r.icon}</div>
              <p className="font-fun font-bold text-lg">{r.title}</p>
              <p className="text-sm text-gray-500 flex-1">{r.description}</p>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
                <span className="text-sm font-bold text-kid-purple">{r.xpCost} XP</span>
                <button
                  disabled={!affordable}
                  onClick={() => redeem(r)}
                  className={`px-4 min-h-[44px] rounded-xl text-sm font-bold ${
                    affordable ? 'bg-kid-teal text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {affordable ? 'Redeem' : 'Need more XP'}
                </button>
              </div>
            </div>
          );
        })}
        {rewards.length === 0 && (
          <p className="text-gray-500 col-span-2 text-center py-6">No rewards yet — ask a parent to add some!</p>
        )}
      </div>

      {myRedemptions.length > 0 && (
        <section>
          <h3 className="font-fun text-lg font-bold text-kid-purple mb-2">My Requests</h3>
          <div className="space-y-2">
            {myRedemptions.map((r) => (
              <div key={r.id} className="bg-white rounded-xl px-4 py-3 shadow flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl">{r.reward?.icon}</span>
                  <span className="font-semibold text-sm truncate">{r.reward?.title}</span>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-blue-100 text-blue-700',
    fulfilled: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${styles[status]}`}>{status}</span>;
}
