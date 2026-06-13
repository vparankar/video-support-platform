require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const rateLimit = require('express-rate-limit');
const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');

const app = express();
const server = http.createServer(app);

// Trust proxy (required for express-rate-limit when using ngrok)
app.set('trust proxy', 1);

// Enable CORS — restrict in production
const corsOrigin = process.env.CLIENT_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// ── Rate limiting ──────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,                   // 20 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,       // 1 minute
  max: 60,                   // 60 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
const recordingsDir = path.join(uploadsDir, 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Mount routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/sessions', apiLimiter, sessionRoutes);

// ── Observability endpoint ─────────────────────────
const { verifyToken, verifyRole } = require('./middleware/authMiddleware');
const models = require('./db/models');
const serverStartTime = Date.now();

app.get('/api/metrics', verifyToken, verifyRole('admin'), (req, res) => {
  try {
    const dbMetrics = models.getMetrics();
    res.json({
      ...dbMetrics,
      uptimeSeconds: Math.floor((Date.now() - serverStartTime) / 1000),
      memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Metrics error:', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// ── Periodic temp customer cleanup (every 6 hours) ─
setInterval(() => {
  try {
    const deleted = models.cleanupTempCustomers(86400); // older than 24h
    if (deleted > 0) console.log(`[cleanup] Removed ${deleted} temp customer accounts`);
  } catch {}
}, 6 * 60 * 60 * 1000);

// In production, serve the built React app
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    // SPA fallback — serve index.html for any non-API/non-upload route
    app.get(/^\/(?!api|uploads|socket\.io).*/, (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }
}

// Socket.io
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST']
  }
});

// Mediasoup & Signaling
let sfuManager;
try {
  sfuManager = require('./mediasoup/sfuManager');
  if (typeof sfuManager.startWorker === 'function') {
    sfuManager.startWorker();
  }
} catch (err) {
  console.warn('Mediasoup SFU Manager could not be loaded. Assuming it will be created later.', err.message);
}

try {
  const { initSocketHandlers } = require('./socket/signaling');
  if (initSocketHandlers) {
    initSocketHandlers(io, sfuManager);
  }
} catch (err) {
  console.warn('Socket signaling handlers could not be loaded. Assuming they will be created later.', err.message);
}

// ── Graceful shutdown ──
process.on('SIGINT', () => { console.log('Received SIGINT. Shutting down...'); process.exit(0); });
process.on('SIGTERM', () => { console.log('Received SIGTERM. Shutting down...'); process.exit(0); });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
