import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJoinInfo, register } from '../api/api';
import atombergLogo from '../assets/atomberg.png';

/**
 * JoinPage — public page for customers to join a session via invite token.
 *
 * URL: /join/:token
 * Flow: fetch session info → enter display name → auto-register as temp
 *       customer → navigate to /room/:sessionId.
 */
export default function JoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joining, setJoining] = useState(false);

  // Fetch session info on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await getJoinInfo(token);
        if (res.data.status === 'ended') {
          setError('This session has already ended.');
        } else {
          setSession(res.data);
        }
      } catch (err) {
        setError('Session not found or link is invalid.');
      }
      setLoading(false);
    }
    load();
  }, [token]);

  const handleJoin = async () => {
    if (!displayName.trim()) return;
    setJoining(true);
    setError('');

    try {
      // Register a temporary customer account
      const username = `${displayName.trim()}_${Date.now()}`;
      const res = await register(username, 'pass123', 'customer');
      const { token: authToken, user } = res.data;

      // Persist to localStorage so AuthContext picks it up
      localStorage.setItem('token', authToken);
      localStorage.setItem('user', JSON.stringify(user));

      // Navigate to the call room via page redirect to reset AuthContext
      window.location.href = `/room/${session.id}`;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join session');
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: '3px solid var(--border-strong)',
          borderTopColor: 'var(--brand-yellow)',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ color: 'var(--text-muted)', marginTop: 14 }}>Loading session…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
        <div className="card" style={{ maxWidth: 420, width: '100%', padding: '2.5rem 2rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Cannot Join</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{error || 'Session unavailable.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1rem' }}>
      <div className="card" style={{ maxWidth: 420, width: '100%', padding: '2.5rem 2rem', textAlign: 'center' }}>
        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
          <img src={atombergLogo} alt="Atomberg Logo" style={{ height: 28, borderRadius: 6 }} />
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>Video Support</span>
        </div>

        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{session.title}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 22 }}>Enter your name to join as a customer</p>

        {error && <p className="error-message" style={{ marginBottom: 12 }}>{error}</p>}

        <input
          className="form-input"
          style={{ marginBottom: 14 }}
          type="text"
          placeholder="Your display name…"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          autoFocus
        />

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.75rem', fontSize: '0.9rem' }}
          onClick={handleJoin}
          disabled={joining}
        >
          {joining ? 'Joining…' : 'Join Call'}
        </button>
      </div>
    </div>
  );
}
