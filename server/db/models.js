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
  // If this user already has a record in this session, just clear left_at (rejoin)
  if (userId) {
    const existing = db.prepare(
      'SELECT id FROM participants WHERE session_id = ? AND user_id = ? AND left_at IS NOT NULL'
    ).get(sessionId, userId);
    if (existing) {
      db.prepare('UPDATE participants SET left_at = NULL WHERE id = ?').run(existing.id);
      return db.prepare('SELECT * FROM participants WHERE id = ?').get(existing.id);
    }
    // Also check if already connected (left_at IS NULL)
    const alreadyConnected = db.prepare(
      'SELECT id FROM participants WHERE session_id = ? AND user_id = ? AND left_at IS NULL'
    ).get(sessionId, userId);
    if (alreadyConnected) {
      return db.prepare('SELECT * FROM participants WHERE id = ?').get(alreadyConnected.id);
    }
  }
  const id = uuidv4();
  const stmt = db.prepare('INSERT INTO participants (id, session_id, user_id, display_name, role) VALUES (?, ?, ?, ?, ?)');
  stmt.run(id, sessionId, userId, displayName, role);
  return db.prepare('SELECT * FROM participants WHERE id = ?').get(id);
};

const removeParticipant = (sessionId, displayName, userId = null) => {
  // Prefer userId for accuracy (displayName can be ambiguous)
  if (userId) {
    const stmt = db.prepare("UPDATE participants SET left_at = strftime('%s','now') WHERE session_id = ? AND user_id = ? AND left_at IS NULL");
    stmt.run(sessionId, userId);
  } else {
    const stmt = db.prepare("UPDATE participants SET left_at = strftime('%s','now') WHERE session_id = ? AND display_name = ? AND left_at IS NULL");
    stmt.run(sessionId, displayName);
  }
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
      (SELECT COUNT(DISTINCT COALESCE(p.user_id, p.display_name)) FROM participants p WHERE p.session_id = s.id AND p.left_at IS NULL) as participant_count,
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

// Full session history with participant counts and message counts for admin
const getAllSessionsDetailed = () => {
  return db.prepare(`
    SELECT s.*,
      (SELECT COUNT(DISTINCT COALESCE(p.user_id, p.display_name)) FROM participants p WHERE p.session_id = s.id) as total_participants,
      (SELECT COUNT(DISTINCT COALESCE(p.user_id, p.display_name)) FROM participants p WHERE p.session_id = s.id AND p.left_at IS NULL) as active_participants,
      (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count,
      (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id AND m.message_type = 'file') as file_count,
      (SELECT u.username FROM users u WHERE u.id = s.created_by) as agent_name
    FROM sessions s
    ORDER BY s.created_at DESC
  `).all();
};

// Detailed event log for a session (participant joins/leaves + messages)
const getSessionEventLog = (sessionId) => {
  const participants = db.prepare(`
    SELECT p.display_name, p.role, p.joined_at, p.left_at,
           u.username as user_email
    FROM participants p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE p.session_id = ?
    ORDER BY p.joined_at ASC
  `).all(sessionId);

  const messages = db.prepare(`
    SELECT display_name, content, message_type, file_name, created_at
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId);

  return { participants, messages };
};

// Extended system stats for admin metrics panel
const getSystemStats = () => {
  const basic = getMetrics();
  const endedSessions = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'ended'").get().count;
  const avgDuration = db.prepare(`
    SELECT AVG(ended_at - started_at) as avg_seconds
    FROM sessions
    WHERE status = 'ended' AND started_at IS NOT NULL AND ended_at IS NOT NULL
  `).get().avg_seconds || 0;
  const totalFiles = db.prepare("SELECT COUNT(*) as count FROM messages WHERE message_type = 'file'").get().count;
  const sessionsToday = db.prepare(`
    SELECT COUNT(*) as count FROM sessions
    WHERE created_at >= strftime('%s', 'now', 'start of day')
  `).get().count;
  const messagesToday = db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE created_at >= strftime('%s', 'now', 'start of day')
  `).get().count;

  return {
    ...basic,
    endedSessions,
    avgDurationSeconds: Math.round(avgDuration),
    totalFiles,
    sessionsToday,
    messagesToday,
  };
};

// Delete temp customer accounts older than the given age (seconds)
const cleanupTempCustomers = (maxAgeSeconds = 86400) => {
  const cutoff = Math.floor(Date.now() / 1000) - maxAgeSeconds;
  // Temp customers have usernames like "Name_1718270000000"
  const stmt = db.prepare(
    "DELETE FROM users WHERE role = 'customer' AND created_at < ? AND username LIKE '%_%'"
  );
  const result = stmt.run(cutoff);
  return result.changes;
};

// Metrics for observability endpoint
const getMetrics = () => {
  const activeSessions = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'active'").get().count;
  const waitingSessions = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'waiting'").get().count;
  const totalSessions = db.prepare("SELECT COUNT(*) as count FROM sessions").get().count;
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  const totalMessages = db.prepare("SELECT COUNT(*) as count FROM messages").get().count;
  const activeParticipants = db.prepare("SELECT COUNT(*) as count FROM participants WHERE left_at IS NULL").get().count;
  return { activeSessions, waitingSessions, totalSessions, totalUsers, totalMessages, activeParticipants };
};

const isParticipant = (sessionId, userId) => {
  if (!userId) return false;
  const row = db.prepare('SELECT 1 FROM participants WHERE session_id = ? AND user_id = ?').get(sessionId, userId);
  return !!row;
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
  getAllSessions,
  getAllSessionsDetailed,
  getSessionEventLog,
  getSystemStats,
  cleanupTempCustomers,
  getMetrics,
  isParticipant
};