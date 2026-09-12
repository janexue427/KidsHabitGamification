import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Landing() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return <Navigate to={user.role === 'kid' ? '/kid' : '/parent'} replace />;
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-kid-purple via-kid-pink to-kid-orange px-4 py-8">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 sm:p-8 text-center">
        <div className="text-6xl mb-2">🏆✨</div>
        <h1 className="font-fun text-4xl font-extrabold text-kid-purple mb-2">QuestFam</h1>
        <p className="text-gray-500 mb-8">Turn everyday habits into an adventure.</p>

        <div className="space-y-3">
          <Link
            to="/kid/login"
            className="block w-full py-4 rounded-2xl bg-kid-yellow text-purple-900 font-fun text-xl font-bold shadow-md hover:scale-[1.02] transition"
          >
            🧒 I'm a Kid
          </Link>
          <Link
            to="/parent/auth"
            className="block w-full py-4 rounded-2xl bg-kid-purple text-white font-fun text-xl font-bold shadow-md hover:scale-[1.02] transition"
          >
            🧑 I'm a Parent
          </Link>
        </div>
      </div>
    </div>
  );
}
