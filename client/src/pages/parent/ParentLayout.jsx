import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const navItems = [
  { to: '/parent', label: 'Dashboard', icon: '📊', end: true },
  { to: '/parent/tasks', label: 'Tasks', icon: '✅' },
  { to: '/parent/milestones', label: 'Milestones', icon: '🏆' },
  { to: '/parent/suggestions', label: 'Suggestions', icon: '💡' },
  { to: '/parent/rewards', label: 'Rewards', icon: '🎁' },
  { to: '/parent/redemptions', label: 'Redemptions', icon: '🎟️' },
  { to: '/parent/checks', label: 'Quest Check', icon: '🔍' },
  { to: '/parent/kids', label: 'Kids', icon: '🧒' },
  { to: '/parent/family', label: 'Family', icon: '⚙️' },
];

export default function ParentLayout() {
  const { user, family, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const navRef = useRef(null);

  // On a phone the tab strip scrolls; keep the current tab in view after navigation.
  useEffect(() => {
    const active = navRef.current?.querySelector('.nav-active');
    active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [pathname]);

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <header className="bg-white border-b px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-fun text-base sm:text-xl font-bold text-kid-purple truncate">
              QuestFam — {family?.name}
            </h1>
            <p className="text-xs text-gray-400 truncate">Invite code: {family?.inviteCode}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden sm:inline text-sm text-gray-600">Hi, {user?.name}</span>
            <button
              onClick={() => {
                logout();
                navigate('/');
              }}
              className="text-sm bg-gray-100 px-3 min-h-[40px] rounded-full hover:bg-gray-200 whitespace-nowrap"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <nav
        ref={navRef}
        className="bg-white border-b px-2 sm:px-6 flex gap-1 overflow-x-auto no-scrollbar snap-x"
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `snap-center shrink-0 px-3 sm:px-4 py-3 min-h-[44px] text-sm font-semibold whitespace-nowrap border-b-2 ${
                isActive
                  ? 'nav-active border-kid-purple text-kid-purple'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`
            }
          >
            <span className="sm:hidden mr-1" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
