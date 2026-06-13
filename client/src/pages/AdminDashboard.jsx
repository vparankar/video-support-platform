import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAllActiveSessions, endSession, getAdminSessionHistory, getSessionEventLog, getAdminStats, resolveFileUrl } from '../api/api';
import atombergLogo from '../assets/atomberg.png';

function formatDate(epoch) {
  if (!epoch) return '—';
  const d = new Date(epoch * 1000);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function duration(created, ended) {
  if (!created) return '—';
  const startMs = created * 1000;
  const endMs = ended ? ended * 1000 : Date.now();
  const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function fmtSec(s) {
  if (!s || s <= 0) return '0m';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── Icons ──
const IconLive = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
);
const IconHistory = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
);
const IconMetrics = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
);

export default function AdminDashboard() {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('live');
  const [liveSessions, setLiveSessions] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [eventModal, setEventModal] = useState(null);
  const [eventLoading, setEventLoading] = useState(false);

  const loadLive = useCallback(async () => {
    try { const r = await getAllActiveSessions(); setLiveSessions(r.data); } catch {}
    setLoading(false);
  }, []);

  const loadHistory = useCallback(async () => {
    try { const r = await getAdminSessionHistory(); setHistory(r.data); } catch {}
    setLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    try { const r = await getAdminStats(); setStats(r.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    setLoading(true);
    if (activeTab === 'live') { loadLive(); const iv = setInterval(loadLive, 8000); return () => clearInterval(iv); }
    if (activeTab === 'history') { loadHistory(); }
    if (activeTab === 'metrics') { loadStats(); const iv = setInterval(loadStats, 15000); return () => clearInterval(iv); }
  }, [activeTab, loadLive, loadHistory, loadStats]);

  const handleEnd = async (id) => { try { await endSession(id); loadLive(); } catch {} };

  const handleViewEvents = async (id) => {
    setEventLoading(true); setEventModal({ loading: true });
    try {
      const r = await getSessionEventLog(id);
      setEventModal(r.data);
    } catch { setEventModal(null); }
    setEventLoading(false);
  };

  const handleSwitchToAgent = async () => {
    if (switching) return;
    setSwitching(true);
    try { await login('agent@atomberg.com', 'agent'); navigate('/dashboard'); }
    catch (err) { console.error('Failed to switch:', err); }
    finally { setSwitching(false); }
  };

  const navItems = [
    { id: 'live', label: 'Live Sessions', Icon: IconLive },
    { id: 'history', label: 'Session History', Icon: IconHistory },
    { id: 'metrics', label: 'System Metrics', Icon: IconMetrics },
  ];

  const overlay = { position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem' };
  const modal = { background:'var(--surface)',borderRadius:'var(--radius-lg)',padding:'2rem',width:'100%',maxWidth:640,border:'1px solid var(--border)',boxShadow:'var(--shadow-dropdown)',maxHeight:'80vh',overflowY:'auto' };

  // ── Stat Cards (reused) ──
  const StatCard = ({ label, value, color }) => (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={color ? { color } : {}}>{value}</div>
    </div>
  );

  return (
    <div className="layout-container">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`sidebar ${isSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand-mark" style={{ background: 'transparent', boxShadow: 'none' }}>
            <img src={atombergLogo} alt="Atomberg" style={{ height: 28, borderRadius: 6, display: 'block' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="brand-title">Video Support</div>
            <span className="brand-subtitle">by Atomberg</span>
          </div>
          <button className="mobile-close-btn" onClick={() => setIsSidebarOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Admin Console</div>
          {navItems.map(({ id, label, Icon }) => (
            <a key={id} href="#" onClick={(e) => { e.preventDefault(); setActiveTab(id); setIsSidebarOpen(false); }}
              className={`nav-item ${activeTab === id ? 'nav-item-active' : ''}`}>
              <Icon /><span>{label}</span>
              {id === 'live' && liveSessions.length > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{liveSessions.length}</span>
              )}
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="demo-switcher">
            <div className="demo-title">Demo Role {switching && <span style={{ fontSize: 9 }}>...</span>}</div>
            <div className="demo-buttons">
              <button className="demo-btn" onClick={handleSwitchToAgent} disabled={switching}>Agent</button>
              <button className="demo-btn demo-btn-active" disabled>Admin</button>
            </div>
          </div>
          <div style={{ padding: '7px 10px', fontSize: 11, color: 'var(--sidebar-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-yellow)', flexShrink: 0 }} />
            <span>Signed in as <strong style={{ color: 'var(--sidebar-text)' }}>{user?.username}</strong></span>
          </div>
          <button onClick={() => { logout(); navigate('/login'); }} className="logout-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="mobile-topbar" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="hamburger-btn" onClick={() => setIsSidebarOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
            </button>
            <div className="brand-mark" style={{ background: 'transparent', boxShadow: 'none', width: 24, height: 24 }}>
              <img src={atombergLogo} alt="Atomberg" style={{ height: 24, borderRadius: 6, display: 'block' }} />
            </div>
            <div className="brand-title" style={{ color: 'var(--text)', fontSize: 16 }}>Admin Console</div>
          </div>
        </div>

        {/* ═══ LIVE SESSIONS TAB ═══ */}
        {activeTab === 'live' && (
          <>
            <div className="page-header">
              <h1 className="page-title">Live Sessions</h1>
              <p className="page-subtitle">Monitor and manage all active support calls in real-time</p>
            </div>
            <div style={{ padding: '0 32px 12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <StatCard label="Active Calls" value={liveSessions.filter(s => s.status === 'active').length} color="var(--green)" />
              <StatCard label="Waiting" value={liveSessions.filter(s => s.status === 'waiting').length} color="var(--amber)" />
              <StatCard label="Total Participants" value={liveSessions.reduce((s, x) => s + (x.participants?.length || 0), 0)} />
            </div>
            <div style={{ padding: '0 32px 32px' }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">Live Call Status</span>
                  <span className="badge badge-red" style={{ animation: 'recPulse 2s infinite' }}>Live</span>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</div>
                  ) : liveSessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No active sessions right now.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead><tr><th>Session Title</th><th>Participants</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                          {liveSessions.map(sess => (
                            <tr key={sess.id}>
                              <td style={{ fontWeight: 600, color: 'var(--text)' }}>{sess.title}</td>
                              <td>{sess.participants?.map(p => p.display_name || p.username).join(', ') || '—'}</td>
                              <td>{duration(sess.created_at)}</td>
                              <td><span className={`badge ${sess.status === 'active' ? 'badge-green' : 'badge-amber'}`}>{sess.status}</span></td>
                              <td><button className="btn btn-danger btn-sm" onClick={() => handleEnd(sess.id)}>End Session</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
              <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-refreshing every 8 seconds</p>
            </div>
          </>
        )}

        {/* ═══ SESSION HISTORY TAB ═══ */}
        {activeTab === 'history' && (
          <>
            <div className="page-header">
              <h1 className="page-title">Session History</h1>
              <p className="page-subtitle">Complete log of all support sessions with event details</p>
            </div>
            <div style={{ padding: '0 32px 32px' }}>
              <div className="card">
                <div className="card-header">
                  <span className="card-title">All Sessions</span>
                  <span className="badge badge-gray">{history.length} total</span>
                </div>
                <div className="card-body" style={{ padding: 0 }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</div>
                  ) : history.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No sessions found.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table">
                        <thead><tr><th>Title</th><th>Agent</th><th>Status</th><th>Created</th><th>Participants</th><th>Messages</th><th>Duration</th><th>Actions</th></tr></thead>
                        <tbody>
                          {history.map(sess => (
                            <tr key={sess.id}>
                              <td style={{ fontWeight: 600, color: 'var(--text)' }}>{sess.title}</td>
                              <td>{sess.agent_name || '—'}</td>
                              <td><span className={`badge ${sess.status === 'active' ? 'badge-green' : sess.status === 'waiting' ? 'badge-amber' : 'badge-gray'}`}>{sess.status}</span></td>
                              <td>{formatDate(sess.created_at)}</td>
                              <td>{sess.total_participants ?? 0}</td>
                              <td>
                                <span>{sess.message_count ?? 0}</span>
                                {sess.file_count > 0 && <span style={{ marginLeft: 4, color: 'var(--blue)', fontSize: 11 }}>({sess.file_count} files)</span>}
                              </td>
                              <td>{duration(sess.started_at || sess.created_at, sess.ended_at)}</td>
                              <td>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleViewEvents(sess.id)}>Event Log</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ═══ SYSTEM METRICS TAB ═══ */}
        {activeTab === 'metrics' && (
          <>
            <div className="page-header">
              <h1 className="page-title">System Metrics</h1>
              <p className="page-subtitle">Operational health and usage statistics</p>
            </div>
            {stats ? (
              <div style={{ padding: '0 32px 32px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
                  <StatCard label="Active Sessions" value={stats.activeSessions} color="var(--green)" />
                  <StatCard label="Waiting Sessions" value={stats.waitingSessions} color="var(--amber)" />
                  <StatCard label="Total Sessions" value={stats.totalSessions} />
                  <StatCard label="Connected Users" value={stats.activeParticipants} color="var(--blue)" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
                  <StatCard label="Sessions Today" value={stats.sessionsToday} />
                  <StatCard label="Messages Today" value={stats.messagesToday} />
                  <StatCard label="Total Messages" value={stats.totalMessages} />
                  <StatCard label="Files Shared" value={stats.totalFiles} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>
                  <StatCard label="Avg Call Duration" value={fmtSec(stats.avgDurationSeconds)} />
                  <StatCard label="Completed Sessions" value={stats.endedSessions} />
                  <StatCard label="Registered Users" value={stats.totalUsers} />
                </div>
                <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Auto-refreshing every 15 seconds</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading metrics…</div>
            )}
          </>
        )}
      </main>

      {/* ═══ EVENT LOG MODAL ═══ */}
      {eventModal && (
        <div style={overlay} onClick={() => setEventModal(null)}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)', marginBottom: '1.25rem' }}>
              Session Event Log {eventModal.session && `— ${eventModal.session.title}`}
            </h3>
            {eventModal.loading ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>Loading…</div>
            ) : (
              <>
                {/* Participant Timeline */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Participants</div>
                  <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', border: '1px solid var(--border)' }}>
                    {eventModal.participants?.length > 0 ? eventModal.participants.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.left_at ? 'var(--red)' : 'var(--green)', flexShrink: 0 }} />
                        <strong style={{ color: 'var(--text)' }}>{p.display_name}</strong>
                        <span className={`badge ${p.role === 'agent' ? 'badge-amber' : 'badge-blue'}`} style={{ fontSize: 10 }}>{p.role}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 'auto' }}>
                          Joined {formatDate(p.joined_at)}{p.left_at ? ` · Left ${formatDate(p.left_at)}` : ' · Still connected'}
                        </span>
                      </div>
                    )) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No participants recorded.</div>}
                  </div>
                </div>
                {/* Chat Log */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Chat Messages ({eventModal.messages?.length || 0})
                  </div>
                  <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', border: '1px solid var(--border)', maxHeight: 250, overflowY: 'auto' }}>
                    {eventModal.messages?.length > 0 ? eventModal.messages.map((msg, i) => (
                      <div key={i} style={{ marginBottom: 6, fontSize: 13, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 600, color: 'var(--brand-yellow)', marginRight: 4 }}>{msg.display_name}:</span>
                        {msg.message_type === 'file' ? (
                          <span style={{ color: 'var(--blue)' }}>📎 {msg.file_name}</span>
                        ) : (
                          <span style={{ color: 'var(--text)' }}>{msg.content}</span>
                        )}
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>{formatDate(msg.created_at)}</span>
                      </div>
                    )) : <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No messages in this session.</div>}
                  </div>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button className="btn btn-secondary" onClick={() => setEventModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
