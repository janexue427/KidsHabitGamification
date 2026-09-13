import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const emptyForm = { title: '', description: '', icon: '✅', xpValue: 10, recurrence: 'daily', daysOfWeek: [], dayOfMonth: 1, kidIds: [] };

function ordinal(n) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${suffix}`;
}

// How a task's schedule reads on its card.
function describeSchedule(task) {
  switch (task.recurrence) {
    case 'daily': return 'every day';
    case 'weekdays': return 'weekdays';
    case 'weekly': return `every ${DOW_LONG[task.daysOfWeek?.[0]] ?? 'week'}`;
    case 'custom': return (task.daysOfWeek || []).map((d) => DOW[d]).join(', ') || 'no days set';
    case 'monthly': return `the ${ordinal(task.dayOfMonth || 1)} of each month`;
    default: return task.recurrence;
  }
}

export default function ParentTasks() {
  const [tasks, setTasks] = useState([]);
  const [kids, setKids] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const [t, k] = await Promise.all([api.get('/tasks'), api.get('/auth/kids')]);
    setTasks(t.tasks);
    setKids(k.kids);
  }

  useEffect(() => {
    load();
  }, []);

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
    if (!confirm(`Delete "${task.title}"? Its completion history goes too.`)) return;
    await api.del(`/tasks/${task.id}`);
    load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h2 className="font-fun text-2xl font-bold text-kid-purple mb-4">Recurring Tasks</h2>
        <div className="space-y-3">
          {tasks.map((task) =>
            editingId === task.id ? (
              <EditTaskCard
                key={task.id}
                task={task}
                kids={kids}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  load();
                }}
              />
            ) : (
              <div key={task.id} className={`bg-white rounded-2xl p-4 shadow ${!task.active && 'opacity-50'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0">{task.icon}</span>
                    <div className="min-w-0">
                      <p className="font-fun font-bold">{task.title}</p>
                      {task.description && <p className="text-xs text-gray-500 break-words">{task.description}</p>}
                      <p className="text-xs text-gray-400">
                        {describeSchedule(task)} · +{task.xpValue} XP · {task.kidIds.length} kid(s) assigned
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => setEditingId(task.id)}
                      className="text-xs bg-kid-purple/10 text-kid-purple font-semibold px-3 min-h-[40px] rounded-lg"
                    >
                      Edit
                    </button>
                    <button onClick={() => toggleActive(task)} className="text-xs bg-gray-100 px-3 min-h-[40px] rounded-lg">
                      {task.active ? 'Pause' : 'Resume'}
                    </button>
                    <button onClick={() => remove(task)} className="text-xs bg-red-50 text-red-600 px-3 min-h-[40px] rounded-lg">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )
          )}
          {tasks.length === 0 && <p className="text-gray-400 text-sm">No tasks yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow h-fit">
        <h3 className="font-fun font-bold text-lg mb-3">New Task</h3>
        <TaskFields form={form} setForm={setForm} kids={kids} />
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
        <button onClick={submit} className="w-full min-h-[48px] mt-3 rounded-lg bg-kid-purple text-white font-semibold">
          Create Task
        </button>
      </div>
    </div>
  );
}

/** Inline editor. Seeded from the task so an untouched field saves unchanged. */
function EditTaskCard({ task, kids, onCancel, onSaved }) {
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    icon: task.icon,
    xpValue: task.xpValue,
    recurrence: task.recurrence,
    daysOfWeek: task.daysOfWeek || [],
    dayOfMonth: task.dayOfMonth ?? 1,
    kidIds: task.kidIds || [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.put(`/tasks/${task.id}`, { ...form, xpValue: Number(form.xpValue) });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-2xl p-4 shadow ring-2 ring-kid-purple">
      <p className="font-fun font-bold text-sm text-kid-purple mb-3">Editing task</p>
      <TaskFields form={form} setForm={setForm} kids={kids} />
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button type="submit" disabled={saving} className="flex-1 min-h-[48px] rounded-lg bg-kid-purple text-white font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 min-h-[48px] rounded-lg bg-gray-100 font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** The same field set for creating and editing, so the two cannot drift apart. */
function TaskFields({ form, setForm, kids }) {
  const toggle = (key, value) =>
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value],
    }));

  return (
    <div className="space-y-3">
      <input
        required
        placeholder="Title (e.g. Brush teeth)"
        value={form.title}
        onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
      />
      <textarea
        placeholder="Description"
        rows={2}
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
      />
      <div className="flex gap-3">
        <input
          aria-label="Icon"
          placeholder="Icon"
          value={form.icon}
          onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
          className="w-16 shrink-0 border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm text-center"
        />
        <label className="flex-1 min-w-0">
          <span className="sr-only">XP value</span>
          <input
            type="number"
            min="1"
            required
            placeholder="XP value"
            value={form.xpValue}
            onChange={(e) => setForm((f) => ({ ...f, xpValue: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
        </label>
      </div>
      <select
        value={form.recurrence}
        onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
      >
        <option value="daily">Every day</option>
        <option value="weekdays">Weekdays only (Mon–Fri)</option>
        <option value="weekly">Once a week</option>
        <option value="custom">Certain days of the week</option>
        <option value="monthly">Once a month</option>
      </select>

      {form.recurrence === 'weekly' && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Which day?</p>
          <div className="flex flex-wrap gap-1">
            {DOW.map((d, i) => (
              <button
                type="button"
                key={d}
                // Weekly means one day, so picking a day replaces the previous one.
                onClick={() => setForm((f) => ({ ...f, daysOfWeek: [i] }))}
                aria-pressed={form.daysOfWeek[0] === i}
                className={`px-3 min-h-[44px] rounded-lg text-xs font-semibold ${
                  form.daysOfWeek[0] === i ? 'bg-kid-purple text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.recurrence === 'custom' && (
        <div>
          <p className="text-xs font-semibold text-gray-500 mb-1">Which days?</p>
          <div className="flex flex-wrap gap-1">
            {DOW.map((d, i) => (
              <button
                type="button"
                key={d}
                onClick={() => toggle('daysOfWeek', i)}
                aria-pressed={form.daysOfWeek.includes(i)}
                className={`px-3 min-h-[44px] rounded-lg text-xs font-semibold ${
                  form.daysOfWeek.includes(i) ? 'bg-kid-purple text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.recurrence === 'monthly' && (
        <label className="block">
          <span className="text-xs font-semibold text-gray-500">Day of the month</span>
          <select
            value={form.dayOfMonth}
            onChange={(e) => setForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) }))}
            className="mt-1 w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{ordinal(d)}</option>
            ))}
          </select>
          {form.dayOfMonth > 28 && (
            <span className="text-xs text-gray-400 mt-1 block">
              Shorter months fall back to the last day.
            </span>
          )}
        </label>
      )}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1">Assign to</p>
        <div className="flex flex-wrap gap-2">
          {kids.map((kid) => (
            <button
              type="button"
              key={kid.id}
              onClick={() => toggle('kidIds', kid.id)}
              aria-pressed={form.kidIds.includes(kid.id)}
              className={`px-3 min-h-[44px] rounded-lg text-sm ${
                form.kidIds.includes(kid.id) ? 'bg-kid-purple/20 ring-2 ring-kid-purple' : 'bg-gray-100'
              }`}
            >
              {kid.avatar} {kid.name}
            </button>
          ))}
          {kids.length === 0 && <p className="text-xs text-gray-400">Add kids first.</p>}
        </div>
      </div>
    </div>
  );
}
