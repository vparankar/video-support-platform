/**
 * Seed script — populates a fresh DB with realistic demo data.
 * Run:  node db/seed.js
 *
 * This will initialise the schema (via require('./database')), then insert
 * demonstration rows that exercise every feature of the platform:
 *
 *   • Users       – agent, admin, 4 customers
 *   • Sessions    – waiting / active / ended (with durations)
 *   • Participants – joins, leaves, reconnects
 *   • Messages    – text chat + file shares
 */

const db = require('./database');          // creates tables + seeds agent/admin
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// ── Helpers ──────────────────────────────────────────
const now = Math.floor(Date.now() / 1000);
const mins = (n) => n * 60;
const hours = (n) => n * 3600;

function insertUser(username, password, role) {
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, username, hash, role, now - hours(48));
  // Return the id whether we just inserted or already existed
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  return row.id;
}

function insertSession(id, title, token, createdBy, status, createdAt, startedAt, endedAt) {
  db.prepare(
    'INSERT INTO sessions (id, title, invite_token, created_by, status, created_at, started_at, ended_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title, token, createdBy, status, createdAt, startedAt, endedAt);
}

function insertParticipant(sessionId, userId, displayName, role, joinedAt, leftAt) {
  db.prepare(
    'INSERT INTO participants (id, session_id, user_id, display_name, role, joined_at, left_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), sessionId, userId, displayName, role, joinedAt, leftAt);
}

function insertMessage(sessionId, senderId, displayName, content, type, fileUrl, fileName, createdAt) {
  db.prepare(
    'INSERT INTO messages (id, session_id, sender_id, display_name, content, message_type, file_url, file_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), sessionId, senderId, displayName, content, type, fileUrl, fileName, createdAt);
}

// ── Clear existing data ──────────────────────────────
db.exec('DELETE FROM messages');
db.exec('DELETE FROM participants');
db.exec('DELETE FROM sessions');
// Keep seeded agent/admin from database.js, delete stale customers
db.exec("DELETE FROM users WHERE role = 'customer'");

console.log('[seed] Cleared old data.');

// ── Users ────────────────────────────────────────────
// Agent & admin are already seeded by database.js, just fetch their IDs
const agentId  = db.prepare("SELECT id FROM users WHERE username = 'agent@atomberg.com'").get().id;
const adminId  = db.prepare("SELECT id FROM users WHERE username = 'admin@atomberg.com'").get().id;

const cust1Id = insertUser('rahul.sharma',   'customer', 'customer');
const cust2Id = insertUser('priya.patel',    'customer', 'customer');
const cust3Id = insertUser('amit.verma',     'customer', 'customer');
const cust4Id = insertUser('sneha.reddy',    'customer', 'customer');

console.log('[seed] Users ready.');

// ── Session 1: ENDED — Completed fan troubleshooting (35 min ago) ──
const s1Id    = uuidv4();
const s1Token = uuidv4();
const s1Start = now - mins(65);
const s1End   = now - mins(35);

insertSession(s1Id, 'Ceiling Fan — Wobble Issue', s1Token, agentId, 'ended', s1Start - mins(5), s1Start, s1End);

insertParticipant(s1Id, agentId,  'agent@atomberg.com', 'agent',    s1Start, s1End);
insertParticipant(s1Id, cust1Id,  'Rahul Sharma',       'customer', s1Start + mins(1), s1End);

insertMessage(s1Id, agentId, 'agent@atomberg.com', 'Hi Rahul, I can see your session. Let me help with the fan wobble.', 'text', null, null, s1Start + mins(1));
insertMessage(s1Id, cust1Id, 'Rahul Sharma', 'Thanks! The fan started wobbling after installation. Here is a video.', 'text', null, null, s1Start + mins(2));
insertMessage(s1Id, cust1Id, 'Rahul Sharma', 'Fan wobble video', 'file', '/uploads/fan_wobble_demo.mp4', 'fan_wobble_video.mp4', s1Start + mins(3));
insertMessage(s1Id, agentId, 'agent@atomberg.com', 'I see — the canopy screws are loose. Can you show me the mounting bracket via your camera?', 'text', null, null, s1Start + mins(5));
insertMessage(s1Id, cust1Id, 'Rahul Sharma', 'Sure, switching to camera now.', 'text', null, null, s1Start + mins(6));
insertMessage(s1Id, agentId, 'agent@atomberg.com', 'Tighten the 3 canopy screws clockwise. That should fix the wobble.', 'text', null, null, s1Start + mins(12));
insertMessage(s1Id, cust1Id, 'Rahul Sharma', 'Done! It is running smooth now. Thank you!', 'text', null, null, s1Start + mins(18));
insertMessage(s1Id, agentId, 'agent@atomberg.com', 'Great, glad I could help. Here is the maintenance guide for reference.', 'text', null, null, s1Start + mins(19));
insertMessage(s1Id, agentId, 'agent@atomberg.com', 'Maintenance guide', 'file', '/uploads/maintenance_guide.pdf', 'Atomberg_Fan_Maintenance.pdf', s1Start + mins(19));

console.log('[seed] Session 1 (ended) seeded.');

// ── Session 2: ENDED — Remote control pairing issue (2 hours ago) ──
const s2Id    = uuidv4();
const s2Token = uuidv4();
const s2Start = now - hours(2) - mins(15);
const s2End   = now - hours(2);

insertSession(s2Id, 'Remote Control Not Pairing', s2Token, agentId, 'ended', s2Start - mins(3), s2Start, s2End);

insertParticipant(s2Id, agentId,  'agent@atomberg.com', 'agent',    s2Start, s2End);
insertParticipant(s2Id, cust2Id,  'Priya Patel',        'customer', s2Start + mins(1), s2End);

// Simulate a customer disconnect + reconnect (demonstrating 3.3)
insertParticipant(s2Id, cust2Id,  'Priya Patel',        'customer', s2Start + mins(5), s2Start + mins(6)); // dropped
insertParticipant(s2Id, cust2Id,  'Priya Patel',        'customer', s2Start + mins(6), s2End);             // reconnected

insertMessage(s2Id, agentId, 'agent@atomberg.com', 'Hello Priya, let us troubleshoot the remote pairing.', 'text', null, null, s2Start + mins(1));
insertMessage(s2Id, cust2Id, 'Priya Patel', 'Hi, the remote blinks but fan does not respond.', 'text', null, null, s2Start + mins(2));
insertMessage(s2Id, agentId, 'agent@atomberg.com', 'Please hold the pair button for 5 seconds until the LED goes solid blue.', 'text', null, null, s2Start + mins(3));
insertMessage(s2Id, cust2Id, 'Priya Patel', 'It worked! The fan is responding now.', 'text', null, null, s2Start + mins(8));
insertMessage(s2Id, agentId, 'agent@atomberg.com', 'Perfect. Here is the remote user manual.', 'text', null, null, s2Start + mins(9));
insertMessage(s2Id, agentId, 'agent@atomberg.com', 'Remote manual', 'file', '/uploads/remote_manual.pdf', 'Remote_User_Manual.pdf', s2Start + mins(9));

console.log('[seed] Session 2 (ended, with reconnect) seeded.');

// ── Session 3: ENDED — Multi-customer group support (yesterday) ──
const s3Id    = uuidv4();
const s3Token = uuidv4();
const s3Start = now - hours(18);
const s3End   = now - hours(17);

insertSession(s3Id, 'Batch Installation Support — Gorakhpur Office', s3Token, agentId, 'ended', s3Start - mins(10), s3Start, s3End);

insertParticipant(s3Id, agentId,  'agent@atomberg.com', 'agent',    s3Start, s3End);
insertParticipant(s3Id, cust3Id,  'Amit Verma',         'customer', s3Start + mins(2), s3End);
insertParticipant(s3Id, cust4Id,  'Sneha Reddy',        'customer', s3Start + mins(4), s3Start + mins(45)); // left early

insertMessage(s3Id, agentId, 'agent@atomberg.com', 'Welcome everyone. We will walk through the batch install for 8 Renesa fans.', 'text', null, null, s3Start + mins(2));
insertMessage(s3Id, cust3Id, 'Amit Verma', 'Hi, I am the site electrician. Need help with the wiring diagram.', 'text', null, null, s3Start + mins(3));
insertMessage(s3Id, cust4Id, 'Sneha Reddy', 'I am the project manager, joining to observe.', 'text', null, null, s3Start + mins(5));
insertMessage(s3Id, agentId, 'agent@atomberg.com', 'Sharing the wiring diagram now.', 'text', null, null, s3Start + mins(6));
insertMessage(s3Id, agentId, 'agent@atomberg.com', 'Wiring diagram', 'file', '/uploads/wiring_diagram.pdf', 'Renesa_Wiring_Diagram.pdf', s3Start + mins(6));
insertMessage(s3Id, cust3Id, 'Amit Verma', 'Got it. Starting with unit 1, can you see my camera?', 'text', null, null, s3Start + mins(8));
insertMessage(s3Id, agentId, 'agent@atomberg.com', 'Yes, looks good. Connect the blue wire to L and brown to N.', 'text', null, null, s3Start + mins(10));
insertMessage(s3Id, cust3Id, 'Amit Verma', 'All 8 done. Thanks for the help!', 'text', null, null, s3Start + mins(50));

console.log('[seed] Session 3 (ended, multi-customer) seeded.');

// ── Session 4: ACTIVE — Ongoing motor noise complaint ──
const s4Id    = uuidv4();
const s4Token = uuidv4();
const s4Start = now - mins(8);

insertSession(s4Id, 'Motor Humming Noise — Studio 6T', s4Token, agentId, 'active', s4Start - mins(2), s4Start, null);

insertParticipant(s4Id, agentId,  'agent@atomberg.com', 'agent',    s4Start, null);
insertParticipant(s4Id, cust1Id,  'Rahul Sharma',       'customer', s4Start + mins(1), null);

insertMessage(s4Id, agentId, 'agent@atomberg.com', 'Hi Rahul, you mentioned a humming noise from the Studio 6T?', 'text', null, null, s4Start + mins(1));
insertMessage(s4Id, cust1Id, 'Rahul Sharma', 'Yes, it started yesterday. Speed 3 and above. Let me show you on camera.', 'text', null, null, s4Start + mins(2));
insertMessage(s4Id, agentId, 'agent@atomberg.com', 'I can hear it. Sounds like a loose blade arm. Can you turn it off and check if any blade arm is rattling?', 'text', null, null, s4Start + mins(4));

console.log('[seed] Session 4 (active) seeded.');

// ── Session 5: WAITING — Scheduled for later ──
const s5Id    = uuidv4();
const s5Token = uuidv4();

insertSession(s5Id, 'New Installation Guidance — Efficio Alpha', s5Token, agentId, 'waiting', now - mins(3), null, null);

console.log('[seed] Session 5 (waiting) seeded.');

// ── Session 6: ENDED — Quick session from today (for "today" metrics) ──
const s6Id    = uuidv4();
const s6Token = uuidv4();
const s6Start = now - hours(4);
const s6End   = now - hours(4) + mins(12);

insertSession(s6Id, 'LED Light Not Working on Fan', s6Token, agentId, 'ended', s6Start - mins(1), s6Start, s6End);

insertParticipant(s6Id, agentId,  'agent@atomberg.com', 'agent',    s6Start, s6End);
insertParticipant(s6Id, cust4Id,  'Sneha Reddy',        'customer', s6Start + mins(1), s6End);

insertMessage(s6Id, agentId, 'agent@atomberg.com', 'Hi Sneha, what is the issue with the LED light?', 'text', null, null, s6Start + mins(1));
insertMessage(s6Id, cust4Id, 'Sneha Reddy', 'The light flickers when I use the dimmer.', 'text', null, null, s6Start + mins(2));
insertMessage(s6Id, agentId, 'agent@atomberg.com', 'The built-in LED is not compatible with external dimmers. Please bypass the dimmer switch.', 'text', null, null, s6Start + mins(4));
insertMessage(s6Id, cust4Id, 'Sneha Reddy', 'That fixed it! Thanks.', 'text', null, null, s6Start + mins(6));

console.log('[seed] Session 6 (ended, today) seeded.');

// ── Summary ──────────────────────────────────────────
const stats = {
  users:        db.prepare('SELECT COUNT(*) as c FROM users').get().c,
  sessions:     db.prepare('SELECT COUNT(*) as c FROM sessions').get().c,
  participants: db.prepare('SELECT COUNT(*) as c FROM participants').get().c,
  messages:     db.prepare('SELECT COUNT(*) as c FROM messages').get().c,
};

console.log('\n[seed] ✔ Database seeded successfully');
console.log(`       Users: ${stats.users}  |  Sessions: ${stats.sessions}  |  Participants: ${stats.participants}  |  Messages: ${stats.messages}`);
console.log('\n  Credentials:');
console.log('    Agent:    agent@atomberg.com / agent');
console.log('    Admin:    admin@atomberg.com / admin');
console.log('    Customer: rahul.sharma / customer');
console.log('    Customer: priya.patel  / customer');
console.log('    Customer: amit.verma   / customer');
console.log('    Customer: sneha.reddy  / customer');

process.exit(0);
