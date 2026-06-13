const models = require('../db/models');

function initChatHandlers(io, socket, peerMap) {
  socket.on('sendMessage', async ({ sessionId, content, type = 'text', fileUrl = null, fileName = null }) => {
    try {
      const peerInfo = peerMap.get(socket.id);
      if (!peerInfo) {
        throw new Error('Peer not found in room');
      }

      const { userId, displayName } = peerInfo;
      const message = await models.saveMessage(sessionId, userId, displayName, content, type, fileUrl, fileName);

      io.to(sessionId).emit('newMessage', {
        id: message.id,
        sessionId: message.session_id,
        displayName: message.display_name,
        content: message.content,
        type: message.message_type,
        fileUrl: message.file_url,
        fileName: message.file_name,
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
