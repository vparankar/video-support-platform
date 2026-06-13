import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AgentDashboard from './pages/AgentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CallRoom from './pages/CallRoom';
import JoinPage from './pages/JoinPage';

// ── Route guards ───────────────────────────────
function ProtectedRoute({ children, roles }) {
  const { isAuthenticated, user, logout } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user?.role)) {
    // Customer trying to access agent/admin pages → log them out
    // (temp customers shouldn't be on dashboard)
    logout();
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RootRedirect() {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Only agents/admins have a dashboard; customers shouldn't land here
  if (user?.role === 'agent' || user?.role === 'admin') {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}

function LoginGuard() {
  const { isAuthenticated, user } = useAuth();
  if (isAuthenticated && (user?.role === 'agent' || user?.role === 'admin')) {
    return <Navigate to="/dashboard" replace />;
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
            <ProtectedRoute roles={['agent', 'admin']}>
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
