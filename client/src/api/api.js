import axios from 'axios';

// In production, VITE_API_URL should point to the deployed server.
// In development, Vite proxy handles /api requests.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'
});

// Attach Authorization header from localStorage if token exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;

// Export the server base URL for socket.io connections
export const getServerUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.DEV) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host}:3001`;
  }
  return '';
};

export const resolveFileUrl = (fileUrl) => {
  if (!fileUrl) return '#';
  // Prevent protocol bypass and stored XSS (e.g. javascript: or data: schemes)
  const lowerUrl = fileUrl.toLowerCase().trim();
  if (lowerUrl.startsWith('javascript:') || lowerUrl.startsWith('data:')) {
    return '#';
  }
  if (fileUrl.startsWith('http')) return fileUrl;
  const serverUrl = getServerUrl();
  if (serverUrl && serverUrl !== '/') {
    return `${serverUrl}${fileUrl}`;
  }
  return fileUrl;
};

// ── Auth ────────────────────────────────────────
export const login = (username, password) =>
  api.post('/auth/login', { username, password });

export const register = (username, password, role = 'customer') =>
  api.post('/auth/register', { username, password, role });

// ── Sessions ────────────────────────────────────
export const createSession = (title) =>
  api.post('/sessions', { title });

export const getSessions = () =>
  api.get('/sessions');

export const getSession = (id) =>
  api.get(`/sessions/${id}`);

export const endSession = (id) =>
  api.put(`/sessions/${id}/end`);

export const getJoinInfo = (token) =>
  api.get(`/sessions/join/${token}`);

export const getAllActiveSessions = () =>
  api.get('/sessions/admin/all');

// ── File Upload ─────────────────────────────────
export const uploadFile = (sessionId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/sessions/${sessionId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ── Admin ────────────────────────────────────────
export const getAdminSessionHistory = () =>
  api.get('/sessions/admin/history');

export const getSessionEventLog = (id) =>
  api.get(`/sessions/admin/sessions/${id}/events`);

export const getAdminStats = () =>
  api.get('/sessions/admin/stats');

export const getMetrics = () =>
  api.get('/metrics');
