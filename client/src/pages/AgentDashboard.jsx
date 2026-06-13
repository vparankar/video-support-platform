import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSessions, createSession, getSession, resolveFileUrl } from '../api/api';
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

export default function AgentDashboard() {
  const { user, logout, login } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatSession, setChatSession] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const r = await getSessions();
      setSessions(r.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const r = await createSession(newTitle.trim());
      setInviteLink(`${window.location.origin}/join/${r.data.invite_token}`);
      setNewTitle('');
      loadSessions();
    } catch {}
    setCreating(false);
  };

  const closeNewModal = () => {
    setShowNewModal(false);
    setNewTitle('');
    setInviteLink('');
  };

  const handleViewRecord = async (id) => {
    setChatLoading(true);
    setShowChatModal(true);
    try {
      const r = await getSession(id);
      setChatSession(r.data);
    } catch {}
    setChatLoading(false);
  };

  const closeChatModal = () => {
    setShowChatModal(false);
    setChatSession(null);
  };

  const handleSwitchToAdmin = async () => {
    if (switching) return;
    setSwitching(true);
    try {
      await login('admin', 'admin123');
      navigate('/admin');
    } catch (err) {
      alert('Failed to switch to Admin role.');
    } finally {
      setSwitching(false);
    }
  };

  // Shared inline styles for modals (since modals are portals/overlays)
  const overlay = { position:'fixed',inset:0,zIndex:100,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem' };
  const modal = { background:'var(--surface)',borderRadius:'var(--radius-lg)',padding:'2rem',width:'100%',maxWidth:480,border:'1px solid var(--border)',boxShadow:'var(--shadow-dropdown)' };
  const input = { width:'100%',padding:'0.7rem 1rem',borderRadius:'var(--radius)',border:'1px solid var(--border-strong)',background:'var(--bg)',color:'var(--text)',fontSize:'0.9rem',outline:'none',fontFamily:'inherit',marginBottom:'1rem' };
  const modalRow = { display:'flex',gap:'0.75rem',justifyContent:'flex-end' };
  const cancelBtn = { padding:'0.55rem 1.1rem',borderRadius:'var(--radius)',border:'1px solid var(--border-strong)',background:'transparent',color:'var(--text-secondary)',cursor:'pointer',fontSize:'0.85rem',fontFamily:'inherit',transition:'background 0.15s' };
  const confirmBtn = { padding:'0.55rem 1.1rem',borderRadius:'var(--radius)',border:'none',background:'var(--brand-yellow)',color:'#111827',fontWeight:600,cursor:'pointer',fontSize:'0.85rem',fontFamily:'inherit',transition:'background 0.15s' };

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
          <div className="nav-section-label">Agent Workspace</div>
          <a href="#" onClick={(e) => { e.preventDefault(); setIsSidebarOpen(false); }} className="nav-item nav-item-active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="9" y1="9" x2="21" y2="9" />
              <line x1="9" y1="15" x2="21" y2="15" />
            </svg>
            <span>Sessions List</span>
          </a>
        </nav>

        <div className="sidebar-footer">
          {/* Role switcher */}
          <div className="demo-switcher">
            <div className="demo-title">
              Demo Role {switching && <span style={{ fontSize: 9 }}>...</span>}
            </div>
            <div className="demo-buttons">
              <button className="demo-btn demo-btn-active" disabled>
                Agent
              </button>
              <button className="demo-btn" onClick={handleSwitchToAdmin} disabled={switching}>
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
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 className="page-title">Agent Sessions</h1>
            <p className="page-subtitle">Create support links and join calls to guide customers</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowNewModal(true)}
          >
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', marginRight: 4 }}>+</span> New Session
          </button>
        </div>

        {/* Table list card */}
        <div style={{ padding: '0 32px 32px' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">All Call Sessions</span>
              <span className="badge badge-gray">{sessions.length} sessions</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading…</div>
              ) : sessions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No sessions yet. Create one to get started.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Participants</th>
                        <th>Duration</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessions.map(sess => (
                        <tr key={sess.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text)' }}>{sess.title}</td>
                          <td>
                            <span className={`badge ${
                              sess.status === 'active' ? 'badge-green' :
                              sess.status === 'waiting' ? 'badge-amber' : 'badge-gray'
                            }`}>
                              {sess.status}
                            </span>
                          </td>
                          <td>{formatDate(sess.created_at)}</td>
                          <td>{sess.participant_count ?? 0}</td>
                          <td>{duration(sess.created_at, sess.ended_at)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {(sess.status === 'active' || sess.status === 'waiting') && (
                                <button className="btn btn-primary btn-sm" onClick={() => navigate(`/room/${sess.id}`)}>
                                  Join Call
                                </button>
                              )}
                              {sess.status === 'ended' && (
                                <>
                                  <button className="btn btn-secondary btn-sm" onClick={() => handleViewRecord(sess.id)}>
                                    View Record
                                  </button>
                                  <a
                                    href={resolveFileUrl(`/uploads/recordings/${sess.id}.mp4`)}
                                    download
                                    className="btn btn-success btn-sm"
                                    title="Download call recording"
                                  >
                                    Recording
                                  </a>
                                </>
                              )}
                            </div>
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
      </main>

      {/* New Session Modal */}
      {showNewModal && (
        <div style={overlay} onClick={closeNewModal}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize:'1.15rem',fontWeight:600,color:'var(--text)',marginBottom:'1.25rem' }}>
              {inviteLink ? 'Session Created' : 'Create New Session'}
            </h3>
            {!inviteLink ? (
              <>
                <input
                  style={input}
                  type="text"
                  placeholder="Enter session title…"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
                <div style={modalRow}>
                  <button style={cancelBtn} onClick={closeNewModal}>Cancel</button>
                  <button
                    style={{ ...confirmBtn, opacity: creating ? 0.6 : 1 }}
                    onClick={handleCreate}
                    disabled={creating}
                  >
                    {creating ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize:'0.85rem',color:'var(--text-secondary)',marginBottom:'0.75rem' }}>Share this link with your customer:</p>
                <div style={{ background:'var(--bg)',borderRadius:'var(--radius)',padding:'0.75rem 1rem',fontSize:'0.82rem',color:'var(--brand-yellow)',wordBreak:'break-all',marginBottom:'1rem',border:'1px solid var(--border)',lineHeight:1.5 }}>
                  {inviteLink}
                </div>
                <div style={modalRow}>
                  <button style={cancelBtn} onClick={closeNewModal}>Close</button>
                  <button
                    style={confirmBtn}
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                      alert('Copied to clipboard!');
                    }}
                  >
                    Copy Link
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Chat History Modal */}
      {showChatModal && (
        <div style={overlay} onClick={closeChatModal}>
          <div style={{ ...modal, maxWidth: 560 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize:'1.15rem',fontWeight:600,color:'var(--text)',marginBottom:'1.25rem' }}>
              Chat History — {chatSession?.title || '…'}
            </h3>
            {chatLoading ? (
              <div style={{ color:'var(--text-muted)',textAlign:'center',padding:'1rem' }}>Loading…</div>
            ) : (
              <div style={{ maxHeight: 350, overflowY: 'auto', background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                {chatSession?.messages?.length > 0 ? chatSession.messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom:'0.65rem',fontSize:'0.85rem',lineHeight:1.4 }}>
                    <span style={{ fontWeight:600,color:'var(--brand-yellow)',marginRight:'0.4rem' }}>{msg.display_name || 'Unknown'}:</span>
                    {msg.message_type === 'file' ? (
                      <a href={resolveFileUrl(msg.file_url)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                        </svg>
                        {msg.file_name}
                      </a>
                    ) : (
                      <span style={{ color:'var(--text)' }}>{msg.content}</span>
                    )}
                    <span style={{ fontSize:'0.7rem',color:'var(--text-muted)',marginLeft:'0.4rem' }}>
                      {new Date(msg.created_at * 1000).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}
                    </span>
                  </div>
                )) : (
                  <div style={{ color:'var(--text-muted)',textAlign:'center',padding:'1rem' }}>No messages in this session.</div>
                )}
              </div>
            )}
            <div style={modalRow}>
              <button style={cancelBtn} onClick={closeChatModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
