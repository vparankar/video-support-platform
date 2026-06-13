import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllActiveSessions, endSession } from '../api/api';
import atombergLogo from '../assets/atomberg.png';

function duration(created) {
  if (!created) return '—';
  const mins = Math.max(0, Math.round((Date.now() - created * 1000) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function AdminDashboard() {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getAllActiveSessions();
      setSessions(r.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  const handleEnd = async (id) => {
    try {
      await endSession(id);
      load();
    } catch {}
  };

  const handleSwitchToAgent = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      await login('agent1', 'agent123');
      navigate('/dashboard');
    } catch (err) {
      alert('Failed to switch to Agent role.');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="layout-container">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-mark" style={{ background: 'transparent', boxShadow: 'none' }}>
            <img src={atombergLogo} alt="Atomberg Logo" style={{ height: 28, borderRadius: 6, display: 'block' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="brand-title">Video Support</div>
            <span className="brand-subtitle">by Atomberg</span>
          </div>
          <button className="mobile-close-btn" onClick={() => setIsSidebarOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Admin Workspace</div>
          <a href="#" onClick={(e) => { e.preventDefault(); setIsSidebarOpen(false); }} className="nav-item nav-item-active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span>Active Sessions</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          {/* Role switcher */}
          <div className="demo-switcher">
            <div className="demo-title">
              Demo Role {switching && <span style={{ fontSize: 9 }}>...</span>}
            </div>
            <div className="demo-buttons">
              <button className="demo-btn" onClick={handleSwitchToAgent} disabled={switching}>
                Agent
              </button>
              <button className="demo-btn demo-btn-active" disabled>
                Admin
              </button>
            </div>
          </div>

          {/* Signed in info */}
          <div style={{ padding: '7px 10px', fontSize: 11, color: 'var(--sidebar-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-yellow)', flexShrink: 0 }} />
            <span>Signed in as <strong style={{ color: 'var(--sidebar-text)' }}>{user?.username}</strong></span>
          </div>

          <button onClick={() => { logout(); navigate('/login'); }} className="logout-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="main-content">
        {/* Mobile topbar */}
        <div className="mobile-topbar" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="hamburger-btn" onClick={() => setIsSidebarOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            <div className="brand-mark" style={{ background: 'transparent', boxShadow: 'none', width: 24, height: 24 }}>
              <img src={atombergLogo} alt="Atomberg Logo" style={{ height: 24, borderRadius: 6, display: 'block' }} />
            </div>
            <div className="brand-title" style={{ color: 'var(--text)', fontSize: 16 }}>Video Support</div>
          </div>
        </div>

        {/* Page Header */}
        <div className="page-header">
          <h1 className="page-title">Admin Console</h1>
          <p className="page-subtitle">Monitoring all live support call sessions ({sessions.length} active)</p>
        </div>

        {/* Table list card */}
        <div style={{ padding: '0 32px 32px' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Live Call Status</span>
              <span className="badge badge-red" style={{ animation: 'recPulse 2s infinite' }}>Live</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</div>
              ) : sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No active sessions right now.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Session Title</th>
                        <th>Participants</th>
                        <th>Duration</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map(sess => (
                        <tr key={sess.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text)' }}>{sess.title}</td>
                          <td>{sess.participants?.map(p => p.display_name || p.username).join(', ') || '—'}</td>
                          <td>{duration(sess.created_at)}</td>
                          <td>
                            <span className={`badge ${
                              sess.status === 'active' ? 'badge-green' : 'badge-amber'
                            }`}>
                              {sess.status}
                            </span>
                          </td>
                          <td>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleEnd(sess.id)}
                            >
                              End Session
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Auto-refreshing every 10 seconds
          </p>
        </div>
      </main>
    </div>
  );
}
