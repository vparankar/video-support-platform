const jwt = require('jsonwebtoken');
const { initChatHandlers } = require('./chat');
const models = require('../db/models');
const recorder = require('../mediasoup/recorder');

function initSocketHandlers(io, sfuManager) {
  // Map to track connected peers
  // socketId -> { sessionId, displayName, role, userId }
  const peerMap = new Map();
  // Map to track pending agent disconnects
  // sessionId -> { timeoutId, oldSocketId }
  const pendingAgentDisconnects = new Map();

  io.on('connection', (socket) => {
    // Initialize chat handlers
    initChatHandlers(io, socket, peerMap);

    socket.on('joinRoom', async ({ sessionId, displayName, role, userId, token }, callback) => {
      try {
        if (role !== 'customer') {
          if (!token) {
            throw new Error('Token required for agents');
          }
          jwt.verify(token, process.env.JWT_SECRET);

          // If agent reconnects during the grace period
          if (pendingAgentDisconnects.has(sessionId)) {
            const { timeoutId, oldSocketId } = pendingAgentDisconnects.get(sessionId);
            clearTimeout(timeoutId);
            pendingAgentDisconnects.delete(sessionId);
            
            // Clean up the old socket's Mediasoup resources
            sfuManager.closePeer(sessionId, oldSocketId);
            peerMap.delete(oldSocketId);
            
            // Notify the room
            socket.to(sessionId).emit('agentReconnected');
          }
        } else {
          if (!displayName) {
            throw new Error('Display name required for customers');
          }
        }

        await sfuManager.getOrCreateRoom(sessionId);

        peerMap.set(socket.id, { sessionId, displayName, role, userId });

        socket.join(sessionId);

        const existingProducers = sfuManager.getRoomProducers(sessionId, socket.id);

        socket.to(sessionId).emit('newPeer', { socketId: socket.id, displayName, role });

        if (typeof callback === 'function') {
          callback({ socketId: socket.id, existingProducers });
        }
      } catch (error) {
        console.error('joinRoom error:', error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    socket.on('getRouterRtpCapabilities', async ({ sessionId }, callback) => {
      try {
        const room = await sfuManager.getOrCreateRoom(sessionId);
        if (typeof callback === 'function') {
          callback({ rtpCapabilities: room.router.rtpCapabilities });
        }
      } catch (error) {
        console.error('getRouterRtpCapabilities error:', error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    socket.on('createWebRtcTransport', async ({ sessionId, direction }, callback) => {
      try {
        const result = await sfuManager.createWebRtcTransport(sessionId, socket.id);
        if (typeof callback === 'function') {
          callback(result);
        }
      } catch (error) {
        console.error('createWebRtcTransport error:', error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    socket.on('connectWebRtcTransport', async ({ sessionId, transportId, dtlsParameters }, callback) => {
      try {
        await sfuManager.connectTransport(sessionId, socket.id, transportId, dtlsParameters);
        if (typeof callback === 'function') {
          callback({ transportId });
        }
      } catch (error) {
        console.error('connectWebRtcTransport error:', error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    socket.on('produce', async ({ sessionId, transportId, kind, rtpParameters, appData }, callback) => {
      try {
        const producerId = await sfuManager.produce(sessionId, socket.id, transportId, kind, rtpParameters, appData);

        socket.to(sessionId).emit('newProducer', {
          producerId,
          producerSocketId: socket.id,
          kind,
          appData
        });

        if (typeof callback === 'function') {
          callback({ producerId });
        }
      } catch (error) {
        console.error('produce error:', error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    socket.on('consume', async ({ sessionId, producerId, producerSocketId, rtpCapabilities }, callback) => {
      try {
        const consumerParams = await sfuManager.consume(sessionId, socket.id, producerSocketId, producerId, rtpCapabilities);
        if (typeof callback === 'function') {
          callback(consumerParams);
        }
      } catch (error) {
        console.error('consume error:', error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    socket.on('resumeConsumer', async ({ sessionId, consumerId }) => {
      try {
        const room = await sfuManager.getOrCreateRoom(sessionId);
        const peer = room.peers.get(socket.id);
        if (peer) {
          const consumer = peer.consumers.get(consumerId);
          if (consumer) {
            await consumer.resume();
          }
        }
      } catch (error) {
        console.error('resumeConsumer error:', error);
      }
    });

    socket.on('producerClosed', ({ sessionId, producerId }) => {
      try {
        sfuManager.closeProducer(sessionId, socket.id, producerId);
        socket.to(sessionId).emit('producerClosed', { producerId, producerSocketId: socket.id });
      } catch (error) {
        console.error('producerClosed error:', error);
      }
    });

    socket.on('endSession', ({ sessionId }) => {
      try {
        const peerInfo = peerMap.get(socket.id);
        if (peerInfo && peerInfo.sessionId === sessionId) {
          // Note: DB status is already updated by the REST PUT /:id/end route.
          // This handler only broadcasts the event and cleans up pending disconnects.
          io.to(sessionId).emit('sessionEnded');

          if (pendingAgentDisconnects.has(sessionId)) {
            const { timeoutId, oldSocketId } = pendingAgentDisconnects.get(sessionId);
            clearTimeout(timeoutId);
            sfuManager.closePeer(sessionId, oldSocketId);
            peerMap.delete(oldSocketId);
            pendingAgentDisconnects.delete(sessionId);
          }
        }
      } catch (error) {
        console.error('endSession error:', error);
      }
    });

    // ── Recording (agent only) ──────────────────────
    socket.on('startRecording', async ({ sessionId }, callback) => {
      try {
        const peerInfo = peerMap.get(socket.id);
        if (!peerInfo || peerInfo.role === 'customer') {
          throw new Error('Only agents can start recording');
        }

        const room = await sfuManager.getOrCreateRoom(sessionId);
        const router = room.router;

        // Collect all producers in the room
        const allProducers = [];
        for (const [, peer] of room.peers.entries()) {
          for (const [, producer] of peer.producers.entries()) {
            allProducers.push({ producer, kind: producer.kind });
          }
        }

        if (allProducers.length === 0) {
          throw new Error('No active producers to record');
        }

        const result = await recorder.startRecording(router, sessionId, allProducers);

        // Notify all participants
        io.to(sessionId).emit('recordingStatus', { status: 'recording' });

        if (typeof callback === 'function') {
          callback(result);
        }
      } catch (error) {
        console.error('startRecording error:', error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    socket.on('stopRecording', async ({ sessionId }, callback) => {
      try {
        const peerInfo = peerMap.get(socket.id);
        if (!peerInfo || peerInfo.role === 'customer') {
          throw new Error('Only agents can stop recording');
        }

        const result = recorder.stopRecording(sessionId);

        // Notify participants recording is processing
        io.to(sessionId).emit('recordingStatus', { status: 'processing' });

        // After a short delay, emit the download URL
        setTimeout(() => {
          const downloadUrl = `/uploads/recordings/${sessionId}.mp4`;
          io.to(sessionId).emit('recordingReady', { downloadUrl });
          io.to(sessionId).emit('recordingStatus', { status: 'ready' });
        }, 2000);

        if (typeof callback === 'function') {
          callback({ filePath: result?.filePath || null });
        }
      } catch (error) {
        console.error('stopRecording error:', error);
        if (typeof callback === 'function') {
          callback({ error: error.message });
        }
      }
    });

    socket.on('disconnect', () => {
      const peerInfo = peerMap.get(socket.id);
      if (peerInfo) {
        const { sessionId, displayName, role } = peerInfo;
        
        if (role === 'customer') {
          sfuManager.closePeer(sessionId, socket.id);
          socket.to(sessionId).emit('peerLeft', { socketId: socket.id, displayName });
          peerMap.delete(socket.id);
        } else {
          // Agent disconnected: inform room and start 60s timeout
          socket.to(sessionId).emit('agentDisconnected', { timeoutSeconds: 60 });
          
          const timeoutId = setTimeout(() => {
            try {
              sfuManager.closePeer(sessionId, socket.id);
              peerMap.delete(socket.id);
              
              models.updateSessionStatus(sessionId, 'ended');
              io.to(sessionId).emit('sessionEnded');
              pendingAgentDisconnects.delete(sessionId);
            } catch (error) {
              console.error('agent timeout error:', error);
            }
          }, 60000);
          
          pendingAgentDisconnects.set(sessionId, { timeoutId, oldSocketId: socket.id });
        }
      }
    });
  });
}

module.exports = { initSocketHandlers };
