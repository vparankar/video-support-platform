const models = require('../db/models');

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Strip HTML/script tags from user input to prevent stored XSS.
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

function isSafeFileUrl(url) {
  if (!url) return true;
  // Ensure the file URL is relative, points strictly to the local uploads directory, and has no protocol prefix
  return url.startsWith('/uploads/') && !url.includes('..') && !url.includes(':');
}

function initChatHandlers(io, socket, peerMap) {
  socket.on('sendMessage', async ({ sessionId, content, type = 'text', fileUrl = null, fileName = null }) => {
    try {
      const peerInfo = peerMap.get(socket.id);
      if (!peerInfo) {
        throw new Error('Peer not found in room');
      }

      // Verify peer belongs to the requested session
      if (peerInfo.sessionId !== sessionId) {
        throw new Error('Session mismatch');
      }

      // Sanitize and validate content
      const cleanContent = sanitize(content);
      if (type === 'text' && (!cleanContent || cleanContent.length === 0)) {
        throw new Error('Empty message');
      }
      if (cleanContent.length > MAX_MESSAGE_LENGTH) {
        throw new Error(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      }

      // Validate file fields to prevent protocol bypass and stored XSS
      if (type === 'file') {
        if (!fileUrl || !isSafeFileUrl(fileUrl)) {
          throw new Error('Invalid or unsafe file URL');
        }
      }

      // Sanitize file fields
      const cleanFileName = fileName ? sanitize(fileName) : null;

      const { userId, displayName } = peerInfo;
      const message = await models.saveMessage(sessionId, userId, displayName, cleanContent, type, fileUrl, cleanFileName);

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
      // Verify peer belongs to the requested session
      const peerInfo = peerMap.get(socket.id);
      if (!peerInfo || peerInfo.sessionId !== sessionId) {
        throw new Error('Not authorized for this session');
      }
      const messages = await models.getMessages(sessionId);
      socket.emit('messageHistory', { messages });
    } catch (error) {
      console.error(`[chat] Error in getMessageHistory:`, error.message);
      socket.emit('error', { message: error.message });
    }
  });
}

module.exports = { initChatHandlers };
