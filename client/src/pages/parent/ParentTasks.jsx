import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const emptyForm = { title: '', description: '', icon: '✅', xpValue: 10, recurrence: 'daily', daysOfWeek: [], kidIds: [] };

export default function ParentTasks() {
  const [tasks, setTasks] = useState([]);
  const [kids, setKids] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function load() {
    const [t, k] = await Promise.all([api.get('/tasks'), api.get('/auth/kids')]);
    setTasks(t.tasks);
    setKids(k.kids);
  }

  useEffect(() => {
    load();
  }, []);

  function toggleKid(id) {
    setForm((f) => ({
      ...f,
      kidIds: f.kidIds.includes(id) ? f.kidIds.filter((k) => k !== id) : [...f.kidIds, id],
    }));
  }

  function toggleDay(d) {
    setForm((f) => ({
      ...f,
      daysOfWeek: f.daysOfWeek.includes(d) ? f.daysOfWeek.filter((x) => x !== d) : [...f.daysOfWeek, d],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/tasks', { ...form, xpValue: Number(form.xpValue) });
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActive(task) {
    await api.put(`/tasks/${task.id}`, { active: !task.active });
    load();
  }

  async function remove(task) {
    if (!confirm(`Delete "${task.title}"?`)) return;
    await api.del(`/tasks/${task.id}`);
    load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h2 className="font-fun text-2xl font-bold text-kid-purple mb-4">Recurring Tasks</h2>
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className={`bg-white rounded-2xl p-4 shadow ${!task.active && 'opacity-50'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{task.icon}</span>
                  <div>
                    <p className="font-fun font-bold">{task.title}</p>
                    <p className="text-xs text-gray-400">
                      {task.recurrence} · +{task.xpValue} XP · {task.kidIds.length} kid(s) assigned
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(task)} className="text-xs bg-gray-100 px-2 py-1 rounded-lg">
                    {task.active ? 'Pause' : 'Resume'}
                  </button>
                  <button onClick={() => remove(task)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {tasks.length === 0 && <p className="text-gray-400 text-sm">No tasks yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow h-fit">
        <h3 className="font-fun font-bold text-lg mb-3">New Task</h3>
        <form onSubmit={submit} className="space-y-3">
          <input required placeholder="Title (e.g. Brush teeth)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-3">
            <input placeholder="Icon" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} className="w-16 border rounded-lg px-3 py-2 text-sm text-center" />
            <input type="number" min="1" required placeholder="XP value" value={form.xpValue} onChange={(e) => setForm((f) => ({ ...f, xpValue: e.target.value }))} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
          </div>
          <select value={form.recurrence} onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="daily">Every day</option>
            <option value="weekdays">Weekdays only</option>
            <option value="custom">Custom days</option>
          </select>
          {form.recurrence === 'custom' && (
            <div className="flex flex-wrap gap-1">
              {DOW.map((d, i) => (
                <button
                  type="button"
                  key={d}
                  onClick={() => toggleDay(i)}
                  className={`px-2 py-1 rounded-lg text-xs font-semibold ${form.daysOfWeek.includes(i) ? 'bg-kid-purple text-white' : 'bg-gray-100 text-gray-500'}`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">Assign to</p>
            <div className="flex flex-wrap gap-2">
              {kids.map((kid) => (
                <button
                  type="button"
                  key={kid.id}
                  onClick={() => toggleKid(kid.id)}
                  className={`px-2 py-1 rounded-lg text-sm ${form.kidIds.includes(kid.id) ? 'bg-kid-purple/20 ring-2 ring-kid-purple' : 'bg-gray-100'}`}
                >
                  {kid.avatar} {kid.name}
                </button>
              ))}
              {kids.length === 0 && <p className="text-xs text-gray-400">Add kids first.</p>}
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full py-2 rounded-lg bg-kid-purple text-white font-semibold">
            Create Task
          </button>
        </form>
      </div>
    </div>
  );
}
