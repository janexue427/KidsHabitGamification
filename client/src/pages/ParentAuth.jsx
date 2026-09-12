import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function ParentAuth() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ familyName: '', parentName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();

  if (!loading && user && !inviteCode) return <Navigate to={user.role === 'kid' ? '/kid' : '/parent'} replace />;

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoadingSubmit(true);
    try {
      if (mode === 'signup') {
        const data = await api.post('/auth/signup', form);
        login(data);
        setInviteCode(data.family.inviteCode);
      } else {
        const data = await api.post('/auth/login', { email: form.email, password: form.password });
        login(data);
        navigate('/parent');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingSubmit(false);
    }
  }

  if (inviteCode) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-kid-purple/10 px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 sm:p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="font-fun text-2xl font-bold mb-2">Family created!</h2>
          <p className="text-gray-600 mb-4">Share this invite code with your kids so they can log in:</p>
          <div className="text-2xl sm:text-3xl font-fun font-extrabold tracking-widest bg-kid-yellow/30 rounded-xl px-2 py-3 mb-6 break-all">
            {inviteCode}
          </div>
          <button
            onClick={() => navigate('/parent')}
            className="w-full min-h-[52px] rounded-xl bg-kid-purple text-white font-semibold"
          >
            Go to my dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-kid-purple/10 px-4 py-8">
      <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 sm:p-8">
        <Link to="/" className="inline-flex items-center min-h-[44px] -mt-2 text-sm text-gray-400 hover:text-gray-600">&larr; Back</Link>
        <h2 className="font-fun text-2xl font-bold mt-2 mb-6">
          {mode === 'login' ? 'Parent Login' : 'Create Your Family'}
        </h2>

        <form onSubmit={submit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <Field label="Family name" value={form.familyName} onChange={update('familyName')} placeholder="The Smiths" />
              <Field label="Your name" value={form.parentName} onChange={update('parentName')} placeholder="Alex" />
            </>
          )}
          <Field label="Email" type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" />
          <Field label="Password" type="password" value={form.password} onChange={update('password')} placeholder="••••••••" />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loadingSubmit}
            className="w-full min-h-[52px] rounded-xl bg-kid-purple text-white font-semibold disabled:opacity-50"
          >
            {mode === 'login' ? 'Log in' : 'Create family'}
          </button>
        </form>

        <button
          className="mt-4 min-h-[44px] text-sm text-kid-purple underline"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? "New here? Create a family" : 'Already have an account? Log in'}
        </button>
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
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-kid-purple"
      />
    </label>
  );
}
