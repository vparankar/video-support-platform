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

// Enable CORS
app.use(cors({ origin: '*' }));
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);

// Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
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
