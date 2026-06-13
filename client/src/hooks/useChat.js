import { useState, useEffect, useCallback } from 'react';

/**
 * useChat — real-time chat over socket.io.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {string} sessionId
 * @param {number} userId
 * @param {string} displayName
 */
export default function useChat(socket, sessionId, userId, displayName, joined) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket || !sessionId || !joined) return;

    // Request history
    socket.emit('getMessageHistory', { sessionId });

    const onHistory = ({ messages: msgs }) => {
      setMessages(msgs || []);
    };

    const onNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    const onHistoryError = (err) => {
      console.warn('[useChat] getMessageHistory error:', err);
    };

    socket.on('messageHistory', onHistory);
    socket.on('newMessage', onNewMessage);
    socket.on('error', onHistoryError);

    return () => {
      socket.off('messageHistory', onHistory);
      socket.off('newMessage', onNewMessage);
      socket.off('error', onHistoryError);
    };
  }, [socket, sessionId, joined]);

  const sendMessage = useCallback(
    (content) => {
      if (!content.trim() || !socket) return;
      socket.emit('sendMessage', { sessionId, content });
    },
    [socket, sessionId]
  );

  const sendFileMessage = useCallback(
    ({ fileName, fileUrl }) => {
      if (!socket) return;
      socket.emit('sendMessage', {
        sessionId,
        content: fileName,
        type: 'file',
        fileUrl,
        fileName,
      });
    },
    [socket, sessionId]
  );

  return { messages, sendMessage, sendFileMessage };
}

