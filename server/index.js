require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');

const app = express();
const server = http.createServer(app);

// Enable CORS — restrict in production
const corsOrigin = process.env.CLIENT_ORIGIN || '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

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
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
