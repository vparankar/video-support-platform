const express = require('express');
const multer = require('multer');
const path = require('path');
const models = require('../db/models');
const { verifyToken, verifyRole } = require('../middleware/authMiddleware');

const router = express.Router();

// ── Multer config for file uploads ──────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_MIMES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  },
});

// Get agent sessions or all sessions for admin
router.get('/', verifyToken, (req, res) => {
  try {
    let sessions;
    if (req.user.role === 'admin') {
      sessions = models.getAllSessions();
    } else {
      sessions = models.getAgentSessions(req.user.id);
    }
    res.json(sessions);
  } catch (err) {
    console.error('Get sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create session (Agent only)
router.post('/', verifyToken, verifyRole('agent', 'admin'), (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const session = models.createSession(req.user.id, title);
    res.json(session);
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin all active sessions
router.get('/admin/all', verifyToken, verifyRole('admin'), (req, res) => {
  try {
    const sessions = models.getAllActiveSessions();
    res.json(sessions);
  } catch (err) {
    console.error('Get all active sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Public invite route
router.get('/join/:token', (req, res) => {
  try {
    const session = models.getSessionByToken(req.params.token);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json({
      id: session.id,
      title: session.title,
      status: session.status
    });
  } catch (err) {
    console.error('Join session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get session details
router.get('/:id', verifyToken, (req, res) => {
  try {
    const session = models.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    session.messages = models.getMessages(session.id);
    session.participants = require('../db/database').prepare("SELECT * FROM participants WHERE session_id = ?").all(session.id);
    
    res.json(session);
  } catch (err) {
    console.error('Get session details error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload file to session
router.post('/:id/upload', verifyToken, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large. Max 10 MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    try {
      const session = models.getSessionById(req.params.id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const fileUrl = `/uploads/${req.file.filename}`;
      const fileName = req.file.originalname;

      res.json({ fileUrl, fileName });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// End session
router.put('/:id/end', verifyToken, verifyRole('agent', 'admin'), (req, res) => {
  try {
    const session = models.getSessionById(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (req.user.role === 'agent' && session.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to end this session' });
    }

    models.updateSessionStatus(session.id, 'ended');
    res.json({ success: true });
  } catch (err) {
    console.error('End session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

