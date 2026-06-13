import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import atombergLogo from '../assets/atomberg.png';
import atombergFullLogo from '../assets/atombergFull.png';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [joinToken, setJoinToken] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleJoinWithToken = () => {
    if (!joinToken.trim()) return;
    let token = joinToken.trim();
    if (token.includes('/join/')) {
      const parts = token.split('/join/');
      token = parts[parts.length - 1];
    }
    token = token.replace(/\/$/, '');
    if (token) {
      navigate(`/join/${token}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left Decorative Panel */}
      <div className="login-left">
        <div style={{ marginBottom: 48 }}>
          <div style={{ marginBottom: 24 }}>
            <img
              src={atombergLogo}
              alt="Atomberg Logo"
              style={{ height: 36, borderRadius: 6, display: 'block' }}
            />
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: -0.3, marginBottom: 6 }}>
            Video Support
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            by Atomberg
          </div>
        </div>

        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 26, fontWeight: 700, color: '#F9FAFB', lineHeight: 1.3, letterSpacing: -0.5, marginBottom: 12 }}>
            Instant Video<br />Support Platform
          </p>
          <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
            Connect with customers in real-time via high-quality video sessions to debug, guide, and resolve issues instantly.
          </p>
        </div>

        <div className="demo-accounts-list" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {[
            { role: 'Agent', username: 'agent@atomberg.com', pw: 'agent' },
            { role: 'Admin', username: 'admin@atomberg.com', pw: 'admin' },
          ].map(acc => (
            <button
              key={acc.role}
              onClick={() => { setUsername(acc.username); setPassword(acc.pw); }}
              type="button"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 4,
                padding: '8px 12px',
                color: '#9CA3AF',
                fontSize: 12,
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(253,185,19,0.08)';
                e.currentTarget.style.borderColor = 'rgba(253,185,19,0.2)';
                e.currentTarget.style.color = '#E5E7EB';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.color = '#9CA3AF';
              }}
            >
              <span style={{ color: 'var(--brand-yellow)', fontWeight: 600 }}>{acc.role}</span>
              {'  '}·{'  '}{acc.username}
            </button>
          ))}
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="login-right">
        <div className="login-card">
          <div className="login-logo" style={{ marginLeft: -45 }}>
            <img
              src={atombergFullLogo}
              alt="Atomberg"
              style={{ height: 64, width: 'auto', display: 'block' }}
            />
          </div>

          {!showTokenInput ? (
            <>
              <h1 className="login-title">Welcome back</h1>
              <p className="login-subtitle">Sign in to your agent account</p>

              <form className="login-form" onSubmit={handleSubmit}>
                {error && <div className="error-message">{error}</div>}

                <div className="form-group">
                  <label htmlFor="username">Username</label>
                  <input
                    id="username"
                    type="text"
                    required
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>

                <button type="submit" disabled={loading} className="submit-btn">
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Customer?{' '}
                  <button
                    type="button"
                    onClick={() => setShowTokenInput(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--brand-yellow)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'inherit' }}
                  >
                    Join call with code / link
                  </button>
                </p>
              </div>
            </>
          ) : (
            <>
              <h1 className="login-title">Join a Call</h1>
              <p className="login-subtitle">Enter your invite code or paste the full link</p>

              {error && <div className="error-message" style={{ marginBottom: 12 }}>{error}</div>}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                <div className="form-group">
                  <label htmlFor="joinToken">Invite code or link</label>
                  <input
                    id="joinToken"
                    type="text"
                    placeholder="e.g. abc-123-xyz or https://…/join/abc-123-xyz"
                    value={joinToken}
                    onChange={(e) => setJoinToken(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoinWithToken()}
                    autoFocus
                    autoComplete="off"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleJoinWithToken}
                  className="submit-btn"
                  style={{ marginTop: 4 }}
                >
                  Join Call
                </button>
              </div>

              <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16, textAlign: 'center' }}>
                <button
                  type="button"
                  onClick={() => setShowTokenInput(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--brand-yellow)', textDecoration: 'underline', cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'inherit' }}
                >
                  ← Back to Agent Sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
