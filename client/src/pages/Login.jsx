import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
    padding: '1rem',
  },
  card: {
    background: '#1e293b',
    borderRadius: '16px',
    padding: '2.5rem',
    width: '100%',
    maxWidth: '420px',
    border: '1px solid rgba(99, 102, 241, 0.15)',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4), 0 0 80px rgba(99, 102, 241, 0.08)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '0.25rem',
    justifyContent: 'center',
  },
  logoDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#6366f1',
    boxShadow: '0 0 12px rgba(99, 102, 241, 0.6)',
  },
  logoText: {
    fontSize: '0.8rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '3px',
    color: '#94a3b8',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    textAlign: 'center',
    marginBottom: '0.25rem',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: '2rem',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#94a3b8',
    marginBottom: '0.4rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f1f5f9',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  },
  inputFocused: {
    border: '1px solid #6366f1',
    boxShadow: '0 0 0 3px rgba(99, 102, 241, 0.15)',
  },
  fieldGroup: {
    marginBottom: '1.25rem',
  },
  button: {
    width: '100%',
    padding: '0.8rem',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.2s',
    fontFamily: 'inherit',
    marginTop: '0.5rem',
  },
  buttonHover: {
    transform: 'translateY(-1px)',
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.35)',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
    transform: 'none',
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '0.65rem 1rem',
    marginBottom: '1rem',
    fontSize: '0.85rem',
    color: '#fca5a5',
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
    marginTop: '1.5rem',
    fontSize: '0.8rem',
    color: '#64748b',
    lineHeight: 1.5,
  },
  hintAccent: {
    color: '#818cf8',
  },
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

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
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <div style={styles.logoDot} />
          <span style={styles.logoText}>Video Support</span>
        </div>
        <h1 style={styles.heading}>Welcome back</h1>
        <p style={styles.subtitle}>Sign in to your agent account</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="login-username">Username</label>
            <input
              id="login-username"
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setFocusedField('username')}
              onBlur={() => setFocusedField('')}
              style={{
                ...styles.input,
                ...(focusedField === 'username' ? styles.inputFocused : {}),
              }}
              autoComplete="username"
              required
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField('')}
              style={{
                ...styles.input,
                ...(focusedField === 'password' ? styles.inputFocused : {}),
              }}
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            onMouseEnter={(e) => {
              if (!loading) Object.assign(e.target.style, styles.buttonHover);
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = '';
              e.target.style.boxShadow = '';
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={styles.hint}>
          Customer? <span style={styles.hintAccent}>Use your invite link directly.</span>
        </p>
      </div>
    </div>
  );
}
