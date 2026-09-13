import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import QuestCelebration from '../../components/QuestCelebration.jsx';
import StreakBanner from '../../components/StreakBanner.jsx';
import WeekStrip from '../../components/WeekStrip.jsx';
import { DIFFICULTIES, difficultyFor } from '../../constants/difficulty.js';

export default function KidHome() {
  const [week, setWeek] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [celebrate, setCelebrate] = useState(null);
  const [rating, setRating] = useState(null);
  const [error, setError] = useState('');
  const { updateUser } = useAuth();

  async function load() {
    const [w, m] = await Promise.all([api.get('/tasks/mine/week'), api.get('/milestones/mine')]);
    setWeek(w);
    setMilestones(m.milestones);
    setSelected((current) => current ?? w.days[0]?.date ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const day = week?.days.find((d) => d.date === selected) ?? week?.days[0];
  const isToday = day?.offset === 0;

  async function complete(task) {
    setError('');
    try {
      const res = await api.post(`/tasks/${task.id}/complete`, { date: day.date });
      updateUser({ totalXp: res.totalXp });
      setCelebrate({
        completionId: res.completionId,
        xp: res.xpAwarded,
        milestones: res.milestonesCompleted,
        taskTitle: task.title,
        streakBonus: res.streakBonus,
        aheadOfTime: res.aheadOfTime,
        difficulty: null,
      });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function rate(completionId, difficulty) {
    setWeek((w) =>
      w && {
        ...w,
        days: w.days.map((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.completionId === completionId ? { ...t, difficulty } : t)),
        })),
      }
    );
    try {
      await api.post(`/tasks/completions/${completionId}/difficulty`, { difficulty });
    } catch {
      load();
    }
  }

  if (loading) return <p className="text-center text-gray-400 py-10">Loading your quests…</p>;

  return (
    <div className="space-y-6 relative">
      {celebrate && (
        <QuestCelebration
          celebration={celebrate}
          onRate={(difficulty) => rate(celebrate.completionId, difficulty)}
          onClose={() => setCelebrate(null)}
        />
      )}

      <StreakBanner streak={week.streak} daysToBonus={week.daysToBonus} />

      <WeekStrip days={week.days} selected={day.date} onSelect={setSelected} />

      <section>
        <div className="flex items-baseline justify-between gap-2 mb-3">
          <h2 className="font-fun text-2xl font-bold text-kid-purple">
            {isToday ? "Today's Quests" : `${day.weekday}'s Quests`}
          </h2>
          {!isToday && <span className="text-xs font-semibold text-kid-orange">finish early ⚡</span>}
        </div>

        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

        {day.tasks.length === 0 && (
          <p className="text-gray-500 bg-white rounded-2xl p-6 text-center shadow">
            {isToday ? 'No quests today — enjoy! 🌤️' : `Nothing scheduled for ${day.weekday}.`}
          </p>
        )}

        <div className="space-y-3">
          {day.tasks.map((task) => {
            const rated = difficultyFor(task.difficulty);
            return (
              <div
                key={task.id}
                className={`rounded-2xl p-4 shadow ${task.completed ? 'bg-green-100' : 'bg-white'}`}
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <span className="text-3xl shrink-0">{task.icon}</span>
                  <div className="flex-1 min-w-[8rem]">
                    <p className="font-fun font-bold text-lg">{task.title}</p>
                    {task.description && <p className="text-sm text-gray-500">{task.description}</p>}
                    <p className="text-xs text-kid-purple font-semibold">
                      +{task.xpValue} XP
                      {task.verified && <span className="ml-2 text-green-700">· checked by a parent ✓</span>}
                    </p>
                  </div>
                  <button
                    disabled={task.completed}
                    onClick={() => complete(task)}
                    className={`ml-auto px-5 min-h-[48px] rounded-xl font-bold text-sm shadow ${
                      task.completed
                        ? 'bg-green-500 text-white cursor-default'
                        : 'bg-kid-purple text-white hover:scale-105 transition'
                    }`}
                  >
                    {task.completed ? 'Done! ✅' : isToday ? 'Complete' : 'Do it early'}
                  </button>
                </div>

                {task.completed && (
                  <div className="mt-3 pt-3 border-t border-green-200">
                    {rating === task.completionId || !rated ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-green-800">How hard was it?</span>
                        {DIFFICULTIES.map((d) => (
                          <button
                            key={d.key}
                            onClick={() => {
                              rate(task.completionId, d.key);
                              setRating(null);
                            }}
                            aria-label={d.label}
                            title={d.label}
                            aria-pressed={task.difficulty === d.key}
                            className={`text-2xl leading-none w-11 h-11 rounded-xl transition active:scale-90 ${
                              task.difficulty === d.key ? 'bg-white ring-2 ring-kid-purple' : 'bg-white/70 hover:bg-white'
                            }`}
                          >
                            {d.emoji}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <button
                        onClick={() => setRating(task.completionId)}
                        className="flex items-center gap-2 text-xs font-semibold text-green-800 min-h-[44px]"
                      >
                        <span className="text-xl qf-badge-pop">{rated.emoji}</span>
                        <span>{rated.label}</span>
                        <span className="text-green-600 underline">change</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
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
                    <span className="text-2xl shrink-0">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-fun font-bold">{m.title}</p>
                      <p className="text-xs text-gray-500">{m.description}</p>
                    </div>
                    <span className="text-xs font-bold text-kid-orange shrink-0 whitespace-nowrap">+{m.bonusXp} XP</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-700 ${m.completedAt ? 'bg-green-500' : 'bg-kid-teal'}`}
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
