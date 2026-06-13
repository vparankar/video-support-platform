const jwt = require('jsonwebtoken');
const { initChatHandlers } = require('./chat');
const models = require('../db/models');

function initSocketHandlers(io, sfuManager) {
  // Map to track connected peers
  // socketId -> { sessionId, displayName, role, userId }
  const peerMap = new Map();
  // Map to track pending agent disconnects
  // sessionId -> { timeoutId, oldSocketId }
  const pendingAgentDisconnects = new Map();

  const checkSocketRoom = (socket, sessionId) => {
    const peerInfo = peerMap.get(socket.id);
    if (!peerInfo || peerInfo.sessionId !== sessionId) {
      throw new Error('Unauthorized room operation');
    }
    return peerInfo;
  };

  io.on('connection', (socket) => {
    // Initialize chat handlers
    initChatHandlers(io, socket, peerMap);

    socket.on('joinRoom', async ({ sessionId, token }, callback) => {
      try {
        if (!token) {
          throw new Error('Authentication token required');
        }

        // ── Verify JWT & extract verified parameters ──
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id;
        const displayName = decoded.username;
        const role = decoded.role;

        // ── Validate session exists and is not ended ──
        const session = models.getSessionById(sessionId);
        if (!session) {
          throw new Error('Session not found');
        }
        if (session.status === 'ended') {
          throw new Error('Session has already ended');
        }

        // Verify agent ownership to prevent cross-agent session joining
        if (role === 'agent' && session.created_by !== userId) {
          throw new Error('Not authorized to join this session as agent');
        }

        if (role !== 'customer') {
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
        }

        // ── Duplicate-join prevention ──
        // If this userId is already connected to this session, evict the old socket
        if (userId) {
          for (const [existingSocketId, info] of peerMap.entries()) {
            if (info.sessionId === sessionId && info.userId === userId && existingSocketId !== socket.id) {
              sfuManager.closePeer(sessionId, existingSocketId);
              io.to(existingSocketId).emit('duplicateSession', { message: 'You joined from another tab/device' });
              const oldSocket = io.sockets.sockets.get(existingSocketId);
              if (oldSocket) oldSocket.leave(sessionId);
              peerMap.delete(existingSocketId);
            }
          }
        }

        await sfuManager.getOrCreateRoom(sessionId);

        peerMap.set(socket.id, { sessionId, displayName, role, userId });

        socket.join(sessionId);

        // Add to participants table
        models.addParticipant(sessionId, displayName, role, userId);

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
        checkSocketRoom(socket, sessionId);
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
        checkSocketRoom(socket, sessionId);
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
        checkSocketRoom(socket, sessionId);
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
        checkSocketRoom(socket, sessionId);
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
        checkSocketRoom(socket, sessionId);
        // Verify producer belongs to the same session
        const producerPeer = peerMap.get(producerSocketId);
        if (!producerPeer || producerPeer.sessionId !== sessionId) {
          throw new Error('Producer is not in the same session');
        }
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
        checkSocketRoom(socket, sessionId);
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
        checkSocketRoom(socket, sessionId);
        sfuManager.closeProducer(sessionId, socket.id, producerId);
        socket.to(sessionId).emit('producerClosed', { producerId, producerSocketId: socket.id });
      } catch (error) {
        console.error('producerClosed error:', error);
      }
    });

    socket.on('toggleVideoState', ({ sessionId, isVideoOff }) => {
      try {
        checkSocketRoom(socket, sessionId);
        socket.to(sessionId).emit('peerVideoStateChanged', { socketId: socket.id, isVideoOff });
      } catch (error) {
        console.error('toggleVideoState error:', error);
      }
    });

    socket.on('endSession', ({ sessionId }) => {
      try {
        const peerInfo = checkSocketRoom(socket, sessionId);
        if (peerInfo.role === 'customer') {
          throw new Error('Only agents can end the session');
        }
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
      } catch (error) {
        console.error('endSession error:', error);
      }
    });

    // ── Customer leaving (explicit, before disconnect) ──
    socket.on('customerLeaving', ({ sessionId }) => {
      const peerInfo = peerMap.get(socket.id);
      if (peerInfo && peerInfo.sessionId === sessionId) {
        models.removeParticipant(sessionId, peerInfo.displayName, peerInfo.userId);
      }
    });

    socket.on('disconnect', () => {
      const peerInfo = peerMap.get(socket.id);
      if (peerInfo) {
        const { sessionId, displayName, role, userId } = peerInfo;
        
        // Mark participant as left in database
        models.removeParticipant(sessionId, displayName, userId);

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
