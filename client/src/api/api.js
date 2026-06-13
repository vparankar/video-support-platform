import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
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
