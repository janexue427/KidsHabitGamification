import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function KidLogin() {
  const [form, setForm] = useState({ inviteCode: '', username: '', pin: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();

  if (!loading && user) return <Navigate to={user.role === 'kid' ? '/kid' : '/parent'} replace />;

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await api.post('/auth/kid-login', form);
      login(data);
      navigate('/kid');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-kid-yellow via-kid-orange to-kid-pink px-4 py-8">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <Link to="/" className="inline-flex items-center min-h-[44px] -mt-2 text-sm text-gray-400 hover:text-gray-600">&larr; Back</Link>
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🚀</div>
          <h2 className="font-fun text-3xl font-extrabold text-kid-purple">Kid Login</h2>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Family Code" value={form.inviteCode} onChange={update('inviteCode')} placeholder="ABC123" autoCapitalize="characters" />
          <Field label="Your Username" value={form.username} onChange={update('username')} placeholder="dragonrider" />
          <Field label="PIN" type="password" inputMode="numeric" value={form.pin} onChange={update('pin')} placeholder="••••" />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[56px] rounded-2xl bg-kid-purple text-white font-fun text-xl font-bold shadow-md disabled:opacity-50"
          >
            Let's go! 🎮
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-600">{label}</span>
      <input
        {...props}
        required
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-kid-purple"
      />
    </label>
  );
}
