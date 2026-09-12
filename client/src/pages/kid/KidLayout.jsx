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
    <div className="min-h-[100dvh] bg-gradient-to-b from-purple-50 to-pink-50">
      <header className="bg-kid-purple text-white px-4 py-3 flex items-center justify-between gap-3 shadow-md sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-3xl shrink-0">{user?.avatar}</span>
          <div className="min-w-0">
            <p className="font-fun text-lg font-bold leading-tight truncate">{user?.name}</p>
            <p className="text-xs text-purple-200">{user?.totalXp ?? 0} XP total</p>
          </div>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/');
          }}
          className="text-sm bg-white/20 px-4 min-h-[44px] shrink-0 rounded-full hover:bg-white/30"
        >
          Log out
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t shadow-inner flex justify-around pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 min-h-[52px] rounded-xl text-xs font-semibold ${
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
