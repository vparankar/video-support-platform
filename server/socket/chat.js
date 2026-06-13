const models = require('../db/models');

function initChatHandlers(io, socket, peerMap) {
  socket.on('sendMessage', async ({ sessionId, content }) => {
    try {
      const peerInfo = peerMap.get(socket.id);
      if (!peerInfo) {
        throw new Error('Peer not found in room');
      }

      const { userId, displayName } = peerInfo;
      const message = await models.saveMessage(sessionId, userId, displayName, content, 'text');

      io.to(sessionId).emit('newMessage', {
        id: message.id,
        sessionId: message.session_id,
        displayName: message.display_name,
        content: message.content,
        type: message.message_type,
        created_at: message.created_at
      });
    } catch (error) {
      console.error(`[chat] Error in sendMessage:`, error.message);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('getMessageHistory', async ({ sessionId }) => {
    try {
      const messages = await models.getMessages(sessionId);
      socket.emit('messageHistory', { messages });
    } catch (error) {
      console.error(`[chat] Error in getMessageHistory:`, error.message);
      socket.emit('error', { message: error.message });
    }
  });
}

module.exports = { initChatHandlers };
