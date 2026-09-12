import { Navigate, Route, Routes } from 'react-router-dom';
import ApiNotConfiguredBanner from './components/ApiNotConfiguredBanner.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import ParentAuth from './pages/ParentAuth.jsx';
import KidLogin from './pages/KidLogin.jsx';

import KidLayout from './pages/kid/KidLayout.jsx';
import KidHome from './pages/kid/KidHome.jsx';
import KidHistory from './pages/kid/KidHistory.jsx';
import KidRewards from './pages/kid/KidRewards.jsx';
import KidSuggest from './pages/kid/KidSuggest.jsx';

import ParentLayout from './pages/parent/ParentLayout.jsx';
import ParentDashboard from './pages/parent/ParentDashboard.jsx';
import ParentTasks from './pages/parent/ParentTasks.jsx';
import ParentMilestones from './pages/parent/ParentMilestones.jsx';
import ParentSuggestions from './pages/parent/ParentSuggestions.jsx';
import ParentRewards from './pages/parent/ParentRewards.jsx';
import ParentRedemptions from './pages/parent/ParentRedemptions.jsx';
import ParentKids from './pages/parent/ParentKids.jsx';

function RequireRole({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenSpinner />;
  if (!user || user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function FullscreenSpinner() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center text-xl text-kid-purple font-fun">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <>
      <ApiNotConfiguredBanner />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/parent/auth" element={<ParentAuth />} />
        <Route path="/kid/login" element={<KidLogin />} />

        <Route
          path="/kid"
          element={
            <RequireRole role="kid">
              <KidLayout />
            </RequireRole>
          }
        >
          <Route index element={<KidHome />} />
          <Route path="history" element={<KidHistory />} />
          <Route path="rewards" element={<KidRewards />} />
          <Route path="suggest" element={<KidSuggest />} />
        </Route>

        <Route
          path="/parent"
          element={
            <RequireRole role="parent">
              <ParentLayout />
            </RequireRole>
          }
        >
          <Route index element={<ParentDashboard />} />
          <Route path="tasks" element={<ParentTasks />} />
          <Route path="milestones" element={<ParentMilestones />} />
          <Route path="suggestions" element={<ParentSuggestions />} />
          <Route path="rewards" element={<ParentRewards />} />
          <Route path="redemptions" element={<ParentRedemptions />} />
          <Route path="kids" element={<ParentKids />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
