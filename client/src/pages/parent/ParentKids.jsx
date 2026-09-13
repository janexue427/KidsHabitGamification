import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client.js';

const avatars = ['🦁', '🐯', '🐼', '🦊', '🐸', '🦄', '🐵', '🐨', '🐰', '🐲'];
const emptyForm = { name: '', username: '', pin: '', avatar: avatars[0] };

export default function ParentKids() {
  const [kids, setKids] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef(null);

  // Each notice owns the countdown that hides it. Without cancelling the
  // previous one, an older timer fires part-way through a newer message and
  // clears a confirmation the parent has not read yet.
  function showNotice(message) {
    clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = setTimeout(() => setNotice(''), 6000);
  }

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  async function load() {
    const data = await api.get('/auth/kids');
    setKids(data.kids);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/kids', form);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="font-fun text-2xl font-bold text-kid-purple">Kids</h2>

      {notice && (
        <p role="status" className="bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl px-4 py-3">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {kids.map((kid) =>
          editingId === kid.id ? (
            <EditKidCard
              key={kid.id}
              kid={kid}
              onCancel={() => setEditingId(null)}
              onSaved={(msg) => {
                setEditingId(null);
                showNotice(msg);
                load();
              }}
            />
          ) : (
            <div key={kid.id} className="bg-white rounded-2xl p-4 shadow flex items-center gap-3 min-w-0">
              <span className="text-3xl shrink-0">{kid.avatar}</span>
              <div className="min-w-0 flex-1">
                <p className="font-fun font-bold truncate">{kid.name}</p>
                <p className="text-xs text-gray-400 truncate">@{kid.username} · {kid.totalXp} XP</p>
              </div>
              <button
                onClick={() => setEditingId(kid.id)}
                className="text-xs bg-kid-purple/10 text-kid-purple font-semibold px-3 min-h-[44px] rounded-lg shrink-0"
              >
                Edit
              </button>
            </div>
          )
        )}
        {kids.length === 0 && <p className="text-gray-400 text-sm">No kids yet — add one below.</p>}
      </div>

      <div className="bg-white rounded-2xl p-4 shadow max-w-md">
        <h3 className="font-fun font-bold text-lg mb-3">Add a kid</h3>
        <form onSubmit={submit} className="space-y-3">
          <AvatarPicker value={form.avatar} onChange={(a) => setForm((f) => ({ ...f, avatar: a }))} />
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
          <input
            required
            placeholder="Username (for kid login)"
            value={form.username}
            onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
          <input
            required
            placeholder="PIN (4–8 digits)"
            inputMode="numeric"
            value={form.pin}
            onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
            className="w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full min-h-[48px] rounded-lg bg-kid-purple text-white font-semibold">
            Add Kid
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Editing a kid. The PIN field is deliberately blank: the stored value is a
 * one-way hash and cannot be shown, so this sets a new one or leaves it alone.
 */
function EditKidCard({ kid, onCancel, onSaved }) {
  const [form, setForm] = useState({ name: kid.name, username: kid.username, avatar: kid.avatar, pin: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = { name: form.name, username: form.username, avatar: form.avatar };
      if (form.pin.trim()) body.pin = form.pin.trim();
      const res = await api.put(`/auth/kids/${kid.id}`, body);
      onSaved(
        res.pinChanged
          ? `${res.kid.name}'s PIN was changed. Tell them the new one — it can't be looked up later.`
          : `${res.kid.name} updated.`
      );
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="bg-white rounded-2xl p-4 shadow ring-2 ring-kid-purple space-y-3">
      <p className="font-fun font-bold text-sm text-kid-purple">Editing {kid.name}</p>

      <AvatarPicker value={form.avatar} onChange={(a) => setForm((f) => ({ ...f, avatar: a }))} />

      <label className="block">
        <span className="text-xs font-semibold text-gray-500">Name</span>
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="mt-1 w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-gray-500">Username</span>
        <input
          required
          value={form.username}
          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
          className="mt-1 w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold text-gray-500">Reset PIN</span>
        <input
          inputMode="numeric"
          placeholder="Leave blank to keep the current PIN"
          value={form.pin}
          onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
          className="mt-1 w-full border rounded-lg px-3 py-2.5 fine:py-2 text-base fine:text-sm"
        />
        <span className="text-xs text-gray-400 mt-1 block">
          PINs are stored scrambled, so a forgotten one is replaced rather than recovered.
        </span>
      </label>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-2">
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

function AvatarPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {avatars.map((a) => (
        <button
          type="button"
          key={a}
          onClick={() => onChange(a)}
          aria-label={`Avatar ${a}`}
          aria-pressed={value === a}
          className={`text-2xl w-12 h-12 flex items-center justify-center rounded-lg ${
            value === a ? 'bg-kid-purple/20 ring-2 ring-kid-purple' : 'bg-gray-50'
          }`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}
