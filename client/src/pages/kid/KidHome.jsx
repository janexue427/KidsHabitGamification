import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function KidHome() {
  const [tasks, setTasks] = useState([]);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [celebrate, setCelebrate] = useState(null);
  const { updateUser } = useAuth();

  async function load() {
    const [t, m] = await Promise.all([api.get('/tasks/mine/today'), api.get('/milestones/mine')]);
    setTasks(t.tasks);
    setMilestones(m.milestones);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function complete(task) {
    try {
      const res = await api.post(`/tasks/${task.id}/complete`, {});
      updateUser({ totalXp: res.totalXp });
      setCelebrate({ xp: res.xpAwarded, milestones: res.milestonesCompleted });
      setTimeout(() => setCelebrate(null), 2600);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (loading) return <p className="text-center text-gray-400 py-10">Loading your quests…</p>;

  return (
    <div className="space-y-8 relative">
      {celebrate && (
        <div className="fixed top-6 inset-x-0 flex justify-center z-50 px-4">
          <div className="bg-kid-yellow text-purple-900 font-fun font-bold text-lg px-6 py-3 rounded-2xl shadow-xl animate-bounce">
            🎉 +{celebrate.xp} XP!
            {celebrate.milestones?.map((m) => (
              <div key={m.milestoneId} className="text-sm font-semibold mt-1">
                🏆 Milestone reached: {m.title} (+{m.bonusXp} XP)
              </div>
            ))}
          </div>
        </div>
      )}

      <section>
        <h2 className="font-fun text-2xl font-bold text-kid-purple mb-3">Today's Quests</h2>
        {tasks.length === 0 && (
          <p className="text-gray-500 bg-white rounded-2xl p-6 text-center shadow">
            No quests for today — check back tomorrow! 🌤️
          </p>
        )}
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-center gap-4 rounded-2xl p-4 shadow ${
                task.completedToday ? 'bg-green-100' : 'bg-white'
              }`}
            >
              <span className="text-3xl">{task.icon}</span>
              <div className="flex-1">
                <p className="font-fun font-bold text-lg">{task.title}</p>
                {task.description && <p className="text-sm text-gray-500">{task.description}</p>}
                <p className="text-xs text-kid-purple font-semibold">+{task.xpValue} XP</p>
              </div>
              <button
                disabled={task.completedToday}
                onClick={() => complete(task)}
                className={`px-4 py-2 rounded-xl font-bold text-sm shadow ${
                  task.completedToday
                    ? 'bg-green-500 text-white cursor-default'
                    : 'bg-kid-purple text-white hover:scale-105 transition'
                }`}
              >
                {task.completedToday ? 'Done! ✅' : 'Complete'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {milestones.length > 0 && (
        <section>
          <h2 className="font-fun text-2xl font-bold text-kid-purple mb-3">Milestones</h2>
          <div className="space-y-3">
            {milestones.map((m) => {
              const pct = Math.min(100, Math.round((m.progress / m.targetCount) * 100));
              return (
                <div key={m.id} className="bg-white rounded-2xl p-4 shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{m.icon}</span>
                    <div className="flex-1">
                      <p className="font-fun font-bold">{m.title}</p>
                      <p className="text-xs text-gray-500">{m.description}</p>
                    </div>
                    <span className="text-xs font-bold text-kid-orange">+{m.bonusXp} XP</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full ${m.completedAt ? 'bg-green-500' : 'bg-kid-teal'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {m.completedAt ? 'Completed! 🎉' : `${m.progress} / ${m.targetCount}`}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
