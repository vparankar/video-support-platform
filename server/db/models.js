const db = require('./database');
const { v4: uuidv4 } = require('uuid');

const createUser = (username, passwordHash, role) => {
  const id = uuidv4();
  const stmt = db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)');
  stmt.run(id, username, passwordHash, role);
  return getUserById(id);
};

const getUserByUsername = (username) => {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
};

const getUserById = (id) => {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
};

const createSession = (agentId, title) => {
  const id = uuidv4();
  const token = uuidv4();
  const stmt = db.prepare('INSERT INTO sessions (id, title, invite_token, created_by) VALUES (?, ?, ?, ?)');
  stmt.run(id, title, token, agentId);
  return getSessionById(id);
};

const getSessionById = (id) => {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
};

const getSessionByToken = (token) => {
  return db.prepare('SELECT * FROM sessions WHERE invite_token = ?').get(token);
};

const updateSessionStatus = (id, status) => {
  let stmt;
  if (status === 'active') {
    stmt = db.prepare("UPDATE sessions SET status = ?, started_at = strftime('%s','now') WHERE id = ?");
  } else if (status === 'ended') {
    stmt = db.prepare("UPDATE sessions SET status = ?, ended_at = strftime('%s','now') WHERE id = ?");
  } else {
    stmt = db.prepare('UPDATE sessions SET status = ? WHERE id = ?');
  }
  stmt.run(status, id);
};

const addParticipant = (sessionId, displayName, role, userId = null) => {
  const id = uuidv4();
  const stmt = db.prepare('INSERT INTO participants (id, session_id, user_id, display_name, role) VALUES (?, ?, ?, ?, ?)');
  stmt.run(id, sessionId, userId, displayName, role);
  return db.prepare('SELECT * FROM participants WHERE id = ?').get(id);
};

const removeParticipant = (sessionId, displayName) => {
  const stmt = db.prepare("UPDATE participants SET left_at = strftime('%s','now') WHERE session_id = ? AND display_name = ? AND left_at IS NULL");
  stmt.run(sessionId, displayName);
};

const saveMessage = (sessionId, senderId, displayName, content, type = 'text', fileUrl = null, fileName = null) => {
  const id = uuidv4();
  const stmt = db.prepare('INSERT INTO messages (id, session_id, sender_id, display_name, content, message_type, file_url, file_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  stmt.run(id, sessionId, senderId, displayName, content, type, fileUrl, fileName);
  return db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
};

const getMessages = (sessionId) => {
  return db.prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(sessionId);
};

const getAgentSessions = (agentId) => {
  return db.prepare(`
    SELECT s.*, 
      (SELECT COUNT(DISTINCT user_id) FROM participants p WHERE p.session_id = s.id AND p.role = 'customer') as participant_count,
      CASE 
        WHEN s.status = 'ended' THEN s.ended_at - s.started_at
        WHEN s.status = 'active' THEN strftime('%s','now') - s.started_at
        ELSE 0 
      END as duration_seconds
    FROM sessions s
    WHERE s.created_by = ?
    ORDER BY s.created_at DESC
  `).all(agentId);
};

const getAllActiveSessions = () => {
  const sessions = db.prepare("SELECT * FROM sessions WHERE status != 'ended' ORDER BY created_at DESC").all();
  for (let session of sessions) {
    session.participants = db.prepare("SELECT * FROM participants WHERE session_id = ?").all(session.id);
  }
  return sessions;
};

const getAllSessions = () => {
  return db.prepare("SELECT * FROM sessions ORDER BY created_at DESC").all();
};

module.exports = {
  createUser,
  getUserByUsername,
  getUserById,
  createSession,
  getSessionById,
  getSessionByToken,
  updateSessionStatus,
  addParticipant,
  removeParticipant,
  saveMessage,
  getMessages,
  getAgentSessions,
  getAllActiveSessions,
  getAllSessions
};