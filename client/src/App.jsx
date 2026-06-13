import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CallRoom from './pages/CallRoom';
import JoinPage from './pages/JoinPage';

// ── Route guards ───────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) {
    // Redirect unauthorized roles to their home instead of logging out.
    // This prevents the crash when an admin navigates to /dashboard
    // (agent page) — they get sent to /admin instead of being logged out.
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'agent') return <Navigate to="/dashboard" replace />;
    // Customers shouldn't be on dashboard pages at all
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'agent') return <Navigate to="/dashboard" replace />;
  return <Navigate to="/login" replace />;
}

function LoginGuard() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated) {
    if (user?.role === 'admin') return <Navigate to="/admin" replace />;
    if (user?.role === 'agent') return <Navigate to="/dashboard" replace />;
  }
  return <Login />;
}

// ── App ─────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginGuard />} />

          <Route path="/dashboard" element={
            <ProtectedRoute roles={['agent']}>
              <AgentDashboard />
            </ProtectedRoute>
          } />

          <Route path="/room/:sessionId" element={
            <ProtectedRoute>
              <CallRoom />
            </ProtectedRoute>
          } />

          <Route path="/join/:token" element={<JoinPage />} />

          <Route path="/admin" element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
