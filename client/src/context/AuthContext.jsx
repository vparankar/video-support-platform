import { createContext, useContext, useState } from 'react';
import { login as apiLogin } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Read localStorage synchronously so auth state is available on the first render.
  // Using useEffect for this caused a race: ProtectedRoute would redirect to /login
  // before the effect could run and populate the state.
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    if (saved) {
      try { return JSON.parse(saved); } catch { localStorage.removeItem('user'); }
    }
    return null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);

  const login = async (username, password) => {
    const res = await apiLogin(username, password);
    const { token: newToken, user: newUser } = res.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
