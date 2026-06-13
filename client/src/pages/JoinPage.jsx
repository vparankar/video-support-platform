import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getJoinInfo, register } from '../api/api';

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

      // Navigate to the call room
      // Full reload so AuthProvider re-mounts with the new credentials
      window.location.href = `/room/${session.id}`;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to join session');
      setJoining(false);
    }
  };

  // ── Render ────────────────────────────────────────

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.spinner} />
          <p style={{ color: '#94a3b8', marginTop: 14 }}>Loading session…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>⚠</div>
          <h2 style={styles.title}>Cannot Join</h2>
          <p style={styles.subtext}>{error || 'Session unavailable.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Branding */}
        <div style={styles.brand}>
          <span style={styles.dot} />
          <span style={styles.brandText}>Video Support</span>
        </div>

        <h2 style={styles.title}>{session.title}</h2>
        <p style={styles.subtext}>Enter your name to join as a customer</p>

        {error && <p style={styles.error}>{error}</p>}

        <input
          style={styles.input}
          type="text"
          placeholder="Your display name…"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          autoFocus
        />

        <button
          style={{ ...styles.joinBtn, opacity: joining ? 0.6 : 1 }}
          onClick={handleJoin}
          disabled={joining}
        >
          {joining ? 'Joining…' : 'Join Call'}
        </button>
      </div>
    </div>
  );
}

// ── Inline styles ──────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  },
  card: {
    background: '#1e293b',
    borderRadius: 16,
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: 420,
    textAlign: 'center',
    border: '1px solid #334155',
    boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#6366f1',
    boxShadow: '0 0 10px rgba(99,102,241,0.5)',
  },
  brandText: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: '#f1f5f9',
  },
  title: {
    fontSize: '1.3rem',
    fontWeight: 700,
    color: '#f1f5f9',
    marginBottom: 6,
  },
  subtext: {
    color: '#94a3b8',
    fontSize: '0.85rem',
    marginBottom: 22,
  },
  error: {
    color: '#ef4444',
    fontSize: '0.82rem',
    marginBottom: 12,
    background: 'rgba(239,68,68,0.08)',
    borderRadius: 8,
    padding: '0.5rem 0.75rem',
    border: '1px solid rgba(239,68,68,0.15)',
  },
  errorIcon: {
    fontSize: '2.5rem',
    marginBottom: 12,
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f1f5f9',
    fontSize: '0.9rem',
    outline: 'none',
    fontFamily: 'inherit',
    marginBottom: 14,
  },
  joinBtn: {
    width: '100%',
    padding: '0.75rem',
    borderRadius: 10,
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  spinner: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: '3px solid #334155',
    borderTopColor: '#6366f1',
    animation: 'spin 0.8s linear infinite',
    margin: '0 auto',
  },
};
