import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export default function KidSuggest() {
  const [form, setForm] = useState({ type: 'task', title: '', description: '', proposedXp: '' });
  const [mine, setMine] = useState([]);
  const [status, setStatus] = useState('');

  async function load() {
    const data = await api.get('/suggestions/mine');
    setMine(data.suggestions);
  }

  useEffect(() => {
    load();
  }, []);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    setStatus('');
    try {
      await api.post('/suggestions', {
        ...form,
        proposedXp: form.proposedXp ? Number(form.proposedXp) : undefined,
      });
      setForm({ type: 'task', title: '', description: '', proposedXp: '' });
      setStatus('sent');
      load();
    } catch (err) {
      setStatus(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-fun text-2xl font-bold text-kid-purple">Suggest an Idea 💡</h2>

      <form onSubmit={submit} className="bg-white rounded-2xl p-4 shadow space-y-3">
        <div className="flex gap-2">
          {['task', 'milestone'].map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setForm((f) => ({ ...f, type: t }))}
              className={`flex-1 min-h-[48px] rounded-xl font-semibold text-sm capitalize ${
                form.type === t ? 'bg-kid-purple text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <Field label="Title" value={form.title} onChange={update('title')} placeholder="Walk the dog every day" />
        <Field label="Description" value={form.description} onChange={update('description')} placeholder="Why this would be awesome" textarea />
        <Field label="Suggested XP (optional)" type="number" value={form.proposedXp} onChange={update('proposedXp')} placeholder="10" />

        {status === 'sent' && <p className="text-green-600 text-sm font-semibold">Sent to your parent! 🎉</p>}
        {status && status !== 'sent' && <p className="text-red-500 text-sm">{status}</p>}

        <button type="submit" className="w-full min-h-[52px] rounded-xl bg-kid-purple text-white font-bold">
          Send Suggestion
        </button>
      </form>

      <section>
        <h3 className="font-fun text-lg font-bold text-kid-purple mb-2">My Suggestions</h3>
        <div className="space-y-2">
          {mine.map((s) => (
            <div key={s.id} className="bg-white rounded-xl px-4 py-3 shadow">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-sm min-w-0 break-words">{s.title}</p>
                <StatusBadge status={s.status} />
              </div>
              {s.parentNote && <p className="text-xs text-gray-500 mt-1">Parent note: {s.parentNote}</p>}
            </div>
          ))}
          {mine.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No suggestions yet.</p>}
        </div>
      </section>
    </div>
  );
}

function Field({ label, textarea, ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      {textarea ? (
        <textarea {...props} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kid-purple" />
      ) : (
        <input {...props} required={label !== 'Suggested XP (optional)' && label !== 'Description'} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-kid-purple" />
      )}
    </label>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };
  return <span className={`text-xs font-bold px-2 py-1 rounded-full shrink-0 ${styles[status]}`}>{status}</span>;
}
