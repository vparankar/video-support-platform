const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');
const uuid = require('uuid');

const dbPath = path.join(__dirname, 'sqlite.db');
const db = new Database(dbPath);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('agent', 'admin', 'customer')),
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    invite_token TEXT UNIQUE NOT NULL,
    created_by TEXT NOT NULL,
    status TEXT DEFAULT 'waiting' CHECK(status IN ('waiting', 'active', 'ended')),
    started_at INTEGER,
    ended_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(created_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS participants (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    joined_at INTEGER DEFAULT (strftime('%s','now')),
    left_at INTEGER,
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    sender_id TEXT,
    display_name TEXT NOT NULL,
    content TEXT,
    message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'file')),
    file_url TEXT,
    file_name TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY(session_id) REFERENCES sessions(id)
  );
`);

// Seed users
const checkAgent = db.prepare("SELECT count(*) as count FROM users WHERE username = 'agent@atomberg.com'");
const { count: agentCount } = checkAgent.get();

if (agentCount === 0) {
  // Try to update existing agent1 / admin if they exist to preserve foreign keys
  const updateUsername = db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE username = ?');
  
  const agentHash = bcrypt.hashSync('agent', 10);
  const agentRes = updateUsername.run('agent@atomberg.com', agentHash, 'agent1');
  
  const adminHash = bcrypt.hashSync('admin', 10);
  const adminRes = updateUsername.run('admin@atomberg.com', adminHash, 'admin');

  // If they didn't exist to be updated (i.e. fresh DB), insert new ones
  const insertUser = db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)');
  if (agentRes.changes === 0) {
    insertUser.run(uuid.v4(), 'agent@atomberg.com', agentHash, 'agent');
  }
  if (adminRes.changes === 0) {
    insertUser.run(uuid.v4(), 'admin@atomberg.com', adminHash, 'admin');
  }
}

module.exports = db;
