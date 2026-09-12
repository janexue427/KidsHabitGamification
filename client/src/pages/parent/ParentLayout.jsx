import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const navItems = [
  { to: '/parent', label: 'Dashboard', end: true },
  { to: '/parent/tasks', label: 'Tasks' },
  { to: '/parent/milestones', label: 'Milestones' },
  { to: '/parent/suggestions', label: 'Suggestions' },
  { to: '/parent/rewards', label: 'Rewards' },
  { to: '/parent/redemptions', label: 'Redemptions' },
  { to: '/parent/kids', label: 'Kids' },
];

export default function ParentLayout() {
  const { user, family, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-fun text-xl font-bold text-kid-purple">QuestFam — {family?.name}</h1>
          <p className="text-xs text-gray-400">Invite code: {family?.inviteCode}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">Hi, {user?.name}</span>
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="text-sm bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200"
          >
            Log out
          </button>
        </div>
      </header>

      <nav className="bg-white border-b px-6 flex gap-1 overflow-x-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 ${
                isActive ? 'border-kid-purple text-kid-purple' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
