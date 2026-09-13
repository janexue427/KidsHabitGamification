import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import GoogleSignIn from '../components/GoogleSignIn.jsx';

export default function ParentAuth() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ familyName: '', parentName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  // A first-time Google user has no family yet; hold their token while we ask.
  const [pendingGoogle, setPendingGoogle] = useState(null);
  const [newFamilyName, setNewFamilyName] = useState('');
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/config').then((c) => setGoogleEnabled(Boolean(c.googleEnabled))).catch(() => {});
  }, []);

  async function signInWithGoogle(credential, familyName) {
    setError('');
    setGoogleBusy(true);
    try {
      const data = await api.post('/auth/google', familyName ? { credential, familyName } : { credential });
      if (data.needsFamily) {
        setPendingGoogle({ credential, email: data.email, name: data.name });
        setNewFamilyName(`${data.name}'s Family`);
        return;
      }
      login(data);
      if (data.family) setInviteCode(data.family.inviteCode);
      else navigate('/parent');
    } catch (err) {
      setError(err.message);
      setPendingGoogle(null);
    } finally {
      setGoogleBusy(false);
    }
  }

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

  if (pendingGoogle) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-kid-purple/10 px-4 py-8">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-6 sm:p-8">
          <h2 className="font-fun text-2xl font-bold mb-1">One more thing</h2>
          <p className="text-sm text-gray-500 mb-6">
            Signed in as {pendingGoogle.email}. What should we call your family?
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              signInWithGoogle(pendingGoogle.credential, newFamilyName.trim());
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="text-sm font-medium text-gray-600">Family name</span>
              <input
                required
                autoFocus
                value={newFamilyName}
                onChange={(e) => setNewFamilyName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-kid-purple"
              />
            </label>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={googleBusy || !newFamilyName.trim()}
              className="w-full min-h-[52px] rounded-xl bg-kid-purple text-white font-semibold disabled:opacity-50"
            >
              {googleBusy ? 'Creating…' : 'Create my family'}
            </button>
          </form>
          <button onClick={() => setPendingGoogle(null)} className="mt-4 min-h-[44px] text-sm text-gray-400 underline">
            Use a different account
          </button>
        </div>
      </div>
    );
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

        {googleEnabled && (
          <div className="mb-6">
            <GoogleSignIn enabled={googleEnabled} onCredential={signInWithGoogle} disabled={googleBusy} />
            <div className="flex items-center gap-3 mt-6" aria-hidden="true">
              <span className="h-px flex-1 bg-gray-200" />
              <span className="text-xs text-gray-400 uppercase tracking-wide">or use a password</span>
              <span className="h-px flex-1 bg-gray-200" />
            </div>
          </div>
        )}

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
