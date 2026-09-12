import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const navItems = [
  { to: '/kid', label: 'Quests', icon: '⚔️', end: true },
  { to: '/kid/history', label: 'My XP', icon: '📈' },
  { to: '/kid/rewards', label: 'Rewards', icon: '🎁' },
  { to: '/kid/suggest', label: 'Suggest', icon: '💡' },
];

export default function KidLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 pb-20">
      <header className="bg-kid-purple text-white px-4 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{user?.avatar}</span>
          <div>
            <p className="font-fun text-lg font-bold leading-tight">{user?.name}</p>
            <p className="text-xs text-purple-200">{user?.totalXp ?? 0} XP total</p>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="text-sm bg-white/20 px-3 py-1.5 rounded-full hover:bg-white/30"
        >
          Log out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t shadow-inner flex justify-around py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center px-3 py-1 rounded-xl text-xs font-semibold ${
                isActive ? 'text-kid-purple' : 'text-gray-400'
              }`
            }
          >
            <span className="text-2xl">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
