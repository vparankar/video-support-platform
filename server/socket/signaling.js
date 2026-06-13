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

  io.on('connection', (socket) => {
    // Initialize chat handlers
    initChatHandlers(io, socket, peerMap);

    socket.on('joinRoom', async ({ sessionId, displayName, role, userId, token }) => {
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

        const producers = sfuManager.getRoomProducers(sessionId, socket.id);
        socket.emit('existingProducers', producers);

        socket.to(sessionId).emit('newPeer', { socketId: socket.id, displayName, role });

        socket.emit('joinedRoom', { socketId: socket.id });
      } catch (error) {
        console.error('joinRoom error:', error);
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('getRouterRtpCapabilities', async ({ sessionId }) => {
      try {
        const room = await sfuManager.getOrCreateRoom(sessionId);
        socket.emit('routerRtpCapabilities', { rtpCapabilities: room.router.rtpCapabilities });
      } catch (error) {
        console.error('getRouterRtpCapabilities error:', error);
      }
    });

    socket.on('createWebRtcTransport', async ({ sessionId, direction }) => {
      try {
        const result = await sfuManager.createWebRtcTransport(sessionId, socket.id);
        socket.emit('webRtcTransportCreated', { transportParams: result, direction });
      } catch (error) {
        console.error('createWebRtcTransport error:', error);
      }
    });

    socket.on('connectWebRtcTransport', async ({ sessionId, transportId, dtlsParameters }) => {
      try {
        await sfuManager.connectTransport(sessionId, socket.id, transportId, dtlsParameters);
        socket.emit('transportConnected', { transportId });
      } catch (error) {
        console.error('connectWebRtcTransport error:', error);
      }
    });

    socket.on('produce', async ({ sessionId, transportId, kind, rtpParameters, appData }) => {
      try {
        const producerId = await sfuManager.produce(sessionId, socket.id, transportId, kind, rtpParameters, appData);

        socket.to(sessionId).emit('newProducer', {
          producerId,
          producerSocketId: socket.id,
          kind,
          appData
        });

        socket.emit('produced', { producerId });
      } catch (error) {
        console.error('produce error:', error);
      }
    });

    socket.on('consume', async ({ sessionId, producerId, producerSocketId, rtpCapabilities }) => {
      try {
        const consumerParams = await sfuManager.consume(sessionId, socket.id, producerSocketId, producerId, rtpCapabilities);
        socket.emit('consumed', consumerParams);
      } catch (error) {
        console.error('consume error:', error);
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
            socket.emit('consumerResumed');
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
          models.updateSessionStatus(sessionId, 'ended');
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
