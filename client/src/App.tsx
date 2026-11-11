import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Shell } from './components/Shell';
import { AuthPage } from './pages/AuthPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminProfilesPage } from './pages/admin/AdminProfilesPage';
import { AdminAssignmentsPage } from './pages/admin/AdminAssignmentsPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminDevelopersPage } from './pages/admin/AdminDevelopersPage';
import { AdminInterviewsPage } from './pages/admin/AdminInterviewsPage';
import { SelectProfilePage } from './pages/user/SelectProfilePage';
import { UserJobLinksPage } from './pages/user/UserJobLinksPage';
import { SelectJobLinkPage } from './pages/user/SelectJobLinkPage';
import { ResumeContentPage } from './pages/user/ResumeContentPage';
import { UserHistoryPage } from './pages/user/UserHistoryPage';

function LoadingScreen() {
  return (
    <div className="min-h-screen grid place-items-center text-muted">Loading…</div>
  );
}

function RootEntry() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <AuthPage />;
  if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to="/app/profile" replace />;
}

function Protected({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: 'admin' | 'user';
}) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) {
    return (
      <Navigate to={user.role === 'admin' ? '/admin/dashboard' : '/app/profile'} replace />
    );
  }
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootEntry />} />
      <Route path="/auth" element={<Navigate to="/" replace />} />

      <Route
        path="/admin/users"
        element={
          <Protected role="admin">
            <AdminUsersPage />
          </Protected>
        }
      />
      <Route
        path="/admin/profiles"
        element={
          <Protected role="admin">
            <AdminProfilesPage />
          </Protected>
        }
      />
      <Route
        path="/admin/assignments"
        element={
          <Protected role="admin">
            <AdminAssignmentsPage />
          </Protected>
        }
      />
      <Route
        path="/admin/dashboard"
        element={
          <Protected role="admin">
            <AdminAnalyticsPage />
          </Protected>
        }
      />
      <Route path="/admin/analytics" element={<Navigate to="/admin/dashboard" replace />} />
      <Route
        path="/admin/developers"
        element={
          <Protected role="admin">
            <AdminDevelopersPage />
          </Protected>
        }
      />
      <Route
        path="/admin/interviews"
        element={
          <Protected role="admin">
            <AdminInterviewsPage />
          </Protected>
        }
      />

      <Route
        path="/app/profile"
        element={
          <Protected role="user">
            <SelectProfilePage />
          </Protected>
        }
      />
      <Route
        path="/app/job-links"
        element={
          <Protected role="user">
            <UserJobLinksPage />
          </Protected>
        }
      />
      <Route
        path="/app/select-job"
        element={
          <Protected role="user">
            <SelectJobLinkPage />
          </Protected>
        }
      />
      <Route
        path="/app/resume"
        element={
          <Protected role="user">
            <ResumeContentPage />
          </Protected>
        }
      />
      <Route
        path="/app/history"
        element={
          <Protected role="user">
            <UserHistoryPage />
          </Protected>
        }
      />

      <Route path="/app/job-links/select" element={<Navigate to="/app/select-job" replace />} />
      <Route path="/dashboard/*" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
