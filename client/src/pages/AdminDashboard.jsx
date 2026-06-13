import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAllActiveSessions, endSession } from '../api/api';

function duration(created) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(created)) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

const badge = (status) => ({
  display: 'inline-block', padding: '0.2rem 0.65rem', borderRadius: 20,
  fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px',
  ...(status === 'active'
    ? { background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }
    : { background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)' }),
});

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const r = await getAllActiveSessions(); setSessions(r.data); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 10000);
    return () => clearInterval(iv);
  }, [load]);

  const handleEnd = async (id) => {
    try { await endSession(id); load(); } catch {}
  };

  const td = { padding: '0.85rem 1rem', fontSize: '0.88rem', color: '#cbd5e1', verticalAlign: 'middle' };
  const endBtn = { padding: '0.35rem 0.85rem', borderRadius: 7, border: 'none', background: '#ef4444', color: '#fff', fontSize: '0.78rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', background: '#1e293b', borderBottom: '1px solid #334155', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px rgba(239,68,68,0.5)' }} />
          <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9' }}>Admin Dashboard</span>
          <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 8 }}>
            | Active Sessions: {sessions.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{user?.username}</span>
          <button style={{ padding: '0.45rem 1rem', borderRadius: 8, border: '1px solid #334155', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }} onClick={logout}>Logout</button>
        </div>
      </header>

      {/* Body */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
        {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading…</div>
        : sessions.length === 0 ? <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No active sessions right now.</div>
        : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px' }}>
            <thead><tr>
              {['Session Title', 'Participants', 'Duration', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0.6rem 1rem', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: '#64748b' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {sessions.map(sess => (
                <tr key={sess.id} style={{ background: '#1e293b' }} onMouseEnter={e => e.currentTarget.style.background = '#263248'} onMouseLeave={e => e.currentTarget.style.background = '#1e293b'}>
                  <td style={{ ...td, borderRadius: '10px 0 0 10px', fontWeight: 500, color: '#f1f5f9' }}>{sess.title}</td>
                  <td style={td}>{sess.participants?.map(p => p.display_name || p.username).join(', ') || '—'}</td>
                  <td style={td}>{duration(sess.created_at)}</td>
                  <td style={td}><span style={badge(sess.status)}>{sess.status}</span></td>
                  <td style={{ ...td, borderRadius: '0 10px 10px 0' }}>
                    <button style={endBtn} onClick={() => handleEnd(sess.id)} onMouseEnter={e => e.target.style.background = '#dc2626'} onMouseLeave={e => e.target.style.background = '#ef4444'}>End Session</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: '#475569' }}>Auto-refreshing every 10 seconds</p>
      </div>
    </div>
  );
}
