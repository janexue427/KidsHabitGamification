import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';

// A short list covering most families, with the full IANA list behind "Other"
// for anyone we have not guessed.
const COMMON_ZONES = [
  ['America/New_York', 'New York — Eastern'],
  ['America/Chicago', 'Chicago — Central'],
  ['America/Denver', 'Denver — Mountain'],
  ['America/Los_Angeles', 'Los Angeles — Pacific'],
  ['America/Anchorage', 'Anchorage — Alaska'],
  ['Pacific/Honolulu', 'Honolulu — Hawaii'],
  ['America/Toronto', 'Toronto'],
  ['Europe/London', 'London'],
  ['Europe/Paris', 'Paris / Berlin / Madrid'],
  ['Asia/Shanghai', 'Shanghai'],
  ['Asia/Tokyo', 'Tokyo'],
  ['Asia/Kolkata', 'India'],
  ['Australia/Sydney', 'Sydney'],
];

function allZones() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return COMMON_ZONES.map(([z]) => z);
  }
}

export default function ParentFamily() {
  const { family, refresh } = useAuth();
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [showAll, setShowAll] = useState(false);
  const [today, setToday] = useState('');
  const [parents, setParents] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const [me, list] = await Promise.all([api.get('/auth/me'), api.get('/auth/parents')]);
    setName(me.family.name);
    setTimezone(me.family.timezone || 'America/New_York');
    setToday(me.family.today || '');
    setParents(list.parents);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveFamily(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.put('/auth/family', { name, timezone });
      setToday(res.family.today);
      setNotice(`Saved. Your family's day now runs on ${res.family.timezone.replace('_', ' ')}.`);
      setTimeout(() => setNotice(''), 5000);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addParent(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/parents', form);
      setNotice(`${form.name} can now sign in with that email.`);
      setTimeout(() => setNotice(''), 6000);
      setForm({ name: '', email: '', password: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeParent(p) {
    if (!confirm(`Remove ${p.name} from the family? They lose access straight away.`)) return;
    setError('');
    try {
      await api.del(`/auth/parents/${p.id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const zones = showAll ? allZones().map((z) => [z, z.replace(/_/g, ' ')]) : COMMON_ZONES;
  const known = COMMON_ZONES.some(([z]) => z === timezone);

  return (
    <div className="space-y-6">
      <h2 className="font-fun text-2xl font-bold text-kid-purple">Family Settings</h2>

      {notice && (
        <p role="status" className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3">
          {notice}
        </p>
      )}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      <form onSubmit={saveFamily} className="bg-white rounded-2xl p-4 shadow space-y-3 max-w-md">
        <h3 className="font-fun font-bold text-lg">Your family</h3>

        <label className="block">
          <span className="text-xs font-semibold text-gray-500">Family name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-500">Time zone</span>
          <select
            value={known || showAll ? timezone : 'other'}
            onChange={(e) => {
              if (e.target.value === 'other') setShowAll(true);
              else setTimezone(e.target.value);
            }}
            className="mt-1 w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          >
            {zones.map(([z, label]) => (
              <option key={z} value={z}>{label}</option>
            ))}
            {!showAll && <option value="other">Somewhere else…</option>}
          </select>
          <span className="text-xs text-gray-400 mt-1 block">
            This decides when the day starts and ends — when quests reset and streaks count.
            {today && ` Right now it is ${today} for your family.`}
          </span>
        </label>

        <button type="submit" disabled={saving} className="w-full min-h-[48px] rounded-lg bg-kid-purple text-white font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>

      <div className="bg-white rounded-2xl p-4 shadow space-y-3 max-w-md">
        <h3 className="font-fun font-bold text-lg">Grown-ups</h3>
        <p className="text-xs text-gray-500">
          Everyone here can set quests, approve rewards and check work.
        </p>

        <div className="space-y-2">
          {parents.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-b last:border-0 pb-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {p.name} {p.isYou && <span className="text-xs text-gray-400">(you)</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{p.email}</p>
              </div>
              {!p.isYou && (
                <button
                  onClick={() => removeParent(p)}
                  className="text-xs bg-red-50 text-red-600 px-3 min-h-[40px] rounded-lg shrink-0"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={addParent} className="space-y-3 pt-2">
          <p className="text-xs font-semibold text-gray-500">Add another grown-up</p>
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
          <input
            type="password"
            placeholder="A password for them (at least 6 characters)"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
          <button type="submit" className="w-full min-h-[48px] rounded-lg bg-kid-purple text-white font-semibold">
            Add grown-up
          </button>
        </form>
      </div>
    </div>
  );
}
