import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSessions, createSession, getSession } from '../api/api';

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function duration(created, ended) {
  const start = new Date(created);
  const end = ended ? new Date(ended) : new Date();
  const mins = Math.max(0, Math.round((end - start) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const badge = (status) => ({
  display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: 20,
  fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
  ...(status === 'active'
    ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }
    : status === 'waiting'
      ? { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }
      : { background: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.25)' }),
});

export default function AgentDashboard() {
  const { user, logout } = useAuth();
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

  const loadSessions = useCallback(async () => {
    try { const r = await getSessions(); setSessions(r.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

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

  const closeNewModal = () => { setShowNewModal(false); setNewTitle(''); setInviteLink(''); };

  const handleViewRecord = async (id) => {
    setChatLoading(true); setShowChatModal(true);
    try { const r = await getSession(id); setChatSession(r.data); } catch {}
    setChatLoading(false);
  };

  const closeChatModal = () => { setShowChatModal(false); setChatSession(null); };

  // Shared inline styles
  const overlay = { position:'fixed',inset:0,zIndex:50,background:'rgba(0,0,0,0.6)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem' };
  const modal = { background:'#1e293b',borderRadius:14,padding:'2rem',width:'100%',maxWidth:480,border:'1px solid #334155',boxShadow:'0 25px 60px rgba(0,0,0,0.5)' };
  const input = { width:'100%',padding:'0.7rem 1rem',borderRadius:8,border:'1px solid #334155',background:'#0f172a',color:'#f1f5f9',fontSize:'0.9rem',outline:'none',fontFamily:'inherit',marginBottom:'1rem' };
  const modalRow = { display:'flex',gap:'0.75rem',justifyContent:'flex-end' };
  const cancelBtn = { padding:'0.55rem 1.1rem',borderRadius:8,border:'1px solid #334155',background:'transparent',color:'#94a3b8',cursor:'pointer',fontSize:'0.85rem',fontFamily:'inherit' };
  const confirmBtn = { padding:'0.55rem 1.1rem',borderRadius:8,border:'none',background:'#6366f1',color:'#fff',fontWeight:600,cursor:'pointer',fontSize:'0.85rem',fontFamily:'inherit' };
  const td = { padding:'0.85rem 1rem',fontSize:'0.88rem',color:'#cbd5e1',verticalAlign:'middle' };
  const actionBtn = { padding:'0.35rem 0.85rem',borderRadius:7,border:'none',background:'#6366f1',color:'#fff',fontSize:'0.78rem',fontWeight:500,cursor:'pointer',fontFamily:'inherit',marginRight:'0.5rem' };
  const viewBtn = { padding:'0.35rem 0.85rem',borderRadius:7,border:'1px solid #334155',background:'transparent',color:'#94a3b8',fontSize:'0.78rem',fontWeight:500,cursor:'pointer',fontFamily:'inherit' };

  return (
    <div style={{ minHeight:'100vh',background:'#0f172a' }}>
      {/* Header */}
      <header style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'1rem 2rem',background:'#1e293b',borderBottom:'1px solid #334155',position:'sticky',top:0,zIndex:10 }}>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ width:8,height:8,borderRadius:'50%',background:'#6366f1',boxShadow:'0 0 10px rgba(99,102,241,0.5)' }} />
          <span style={{ fontSize:'1.1rem',fontWeight:600,color:'#f1f5f9' }}>Video Support</span>
          <span style={{ fontSize:'0.8rem',color:'#64748b',marginLeft:'0.5rem' }}>— Agent Dashboard</span>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:'1rem' }}>
          <span style={{ fontSize:'0.82rem',color:'#94a3b8' }}>{user?.username}</span>
          <button style={{ padding:'0.45rem 1rem',borderRadius:8,border:'1px solid #334155',background:'transparent',color:'#94a3b8',cursor:'pointer',fontSize:'0.8rem',fontFamily:'inherit' }} onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      {/* Body */}
      <div style={{ maxWidth:1100,margin:'0 auto',padding:'2rem' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.5rem' }}>
          <h2 style={{ fontSize:'1.25rem',fontWeight:600,color:'#f1f5f9' }}>Sessions</h2>
          <button style={{ padding:'0.6rem 1.25rem',borderRadius:10,border:'none',background:'linear-gradient(135deg,#6366f1,#818cf8)',color:'#fff',fontWeight:600,fontSize:'0.85rem',cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:6 }} onClick={() => setShowNewModal(true)}>
            <span style={{ fontSize:'1.1rem',lineHeight:1 }}>+</span> New Session
          </button>
        </div>

        {loading ? <div style={{ textAlign:'center',padding:'3rem',color:'#64748b' }}>Loading…</div>
        : sessions.length === 0 ? <div style={{ textAlign:'center',padding:'3rem',color:'#64748b' }}>No sessions yet. Create one to get started.</div>
        : (
          <table style={{ width:'100%',borderCollapse:'separate',borderSpacing:'0 6px' }}>
            <thead><tr>
              {['Title','Status','Created','Participants','Duration','Actions'].map(h => (
                <th key={h} style={{ textAlign:'left',padding:'0.6rem 1rem',fontSize:'0.72rem',fontWeight:600,textTransform:'uppercase',letterSpacing:1,color:'#64748b' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sessions.map(sess => (
                <tr key={sess.id} style={{ background:'#1e293b',borderRadius:10 }} onMouseEnter={e=>e.currentTarget.style.background='#263248'} onMouseLeave={e=>e.currentTarget.style.background='#1e293b'}>
                  <td style={{ ...td,borderRadius:'10px 0 0 10px',fontWeight:500,color:'#f1f5f9' }}>{sess.title}</td>
                  <td style={td}><span style={badge(sess.status)}>{sess.status}</span></td>
                  <td style={td}>{formatDate(sess.created_at)}</td>
                  <td style={td}>{sess.participant_count ?? '—'}</td>
                  <td style={td}>{duration(sess.created_at, sess.ended_at)}</td>
                  <td style={{ ...td,borderRadius:'0 10px 10px 0' }}>
                    {(sess.status === 'active' || sess.status === 'waiting') && <button style={actionBtn} onClick={() => navigate(`/room/${sess.id}`)}>Join Call</button>}
                    {sess.status === 'ended' && <>
                      <button style={viewBtn} onClick={() => handleViewRecord(sess.id)}>View Record</button>
                      <a
                        href={`/uploads/recordings/${sess.id}.mp4`}
                        download
                        style={{ ...viewBtn, display: 'inline-block', textDecoration: 'none', color: '#6ee7b7', borderColor: 'rgba(34,197,94,0.3)', marginLeft: '0.4rem' }}
                        title="Download call recording"
                      >
                        🎬 Recording
                      </a>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Session Modal */}
      {showNewModal && (
        <div style={overlay} onClick={closeNewModal}>
          <div style={modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize:'1.15rem',fontWeight:600,color:'#f1f5f9',marginBottom:'1.25rem' }}>
              {inviteLink ? '🎉  Session Created' : 'Create New Session'}
            </h3>
            {!inviteLink ? (<>
              <input style={input} type="text" placeholder="Enter session title…" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus onKeyDown={e => e.key === 'Enter' && handleCreate()} />
              <div style={modalRow}>
                <button style={cancelBtn} onClick={closeNewModal}>Cancel</button>
                <button style={{ ...confirmBtn,opacity:creating?0.6:1 }} onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
              </div>
            </>) : (<>
              <p style={{ fontSize:'0.85rem',color:'#94a3b8',marginBottom:'0.75rem' }}>Share this link with your customer:</p>
              <div style={{ background:'#0f172a',borderRadius:8,padding:'0.75rem 1rem',fontSize:'0.82rem',color:'#818cf8',wordBreak:'break-all',marginBottom:'1rem',border:'1px solid rgba(99,102,241,0.2)',lineHeight:1.5 }}>{inviteLink}</div>
              <div style={modalRow}>
                <button style={cancelBtn} onClick={closeNewModal}>Close</button>
                <button style={{ ...confirmBtn,background:'linear-gradient(135deg,#6366f1,#818cf8)' }} onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy Link</button>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* Chat History Modal */}
      {showChatModal && (
        <div style={overlay} onClick={closeChatModal}>
          <div style={{ ...modal,maxWidth:560 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize:'1.15rem',fontWeight:600,color:'#f1f5f9',marginBottom:'1.25rem' }}>Chat History — {chatSession?.title || '…'}</h3>
            {chatLoading ? <div style={{ color:'#475569',textAlign:'center',padding:'1rem' }}>Loading…</div> : (
              <div style={{ maxHeight:350,overflowY:'auto',background:'#0f172a',borderRadius:8,padding:'1rem',marginBottom:'1rem',border:'1px solid #334155' }}>
                {chatSession?.messages?.length > 0 ? chatSession.messages.map((msg, i) => (
                  <div key={i} style={{ marginBottom:'0.65rem',fontSize:'0.85rem',lineHeight:1.4 }}>
                    <span style={{ fontWeight:600,color:'#818cf8',marginRight:'0.4rem' }}>{msg.sender_name || 'Unknown'}:</span>
                    <span style={{ color:'#cbd5e1' }}>{msg.content}</span>
                    <span style={{ fontSize:'0.7rem',color:'#475569',marginLeft:'0.4rem' }}>{new Date(msg.created_at).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                )) : <div style={{ color:'#475569',textAlign:'center',padding:'1rem' }}>No messages in this session.</div>}
              </div>
            )}
            <div style={modalRow}><button style={cancelBtn} onClick={closeChatModal}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
