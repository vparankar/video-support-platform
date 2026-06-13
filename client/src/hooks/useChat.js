import { useState, useEffect, useCallback } from 'react';

/**
 * useChat — real-time chat over socket.io.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {string} sessionId
 * @param {number} userId
 * @param {string} displayName
 */
export default function useChat(socket, sessionId, userId, displayName) {
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket || !sessionId) return;

    // Request history
    socket.emit('getMessageHistory', { sessionId });

    const onHistory = ({ messages: msgs }) => {
      setMessages(msgs || []);
    };

    const onNewMessage = (msg) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on('messageHistory', onHistory);
    socket.on('newMessage', onNewMessage);

    return () => {
      socket.off('messageHistory', onHistory);
      socket.off('newMessage', onNewMessage);
    };
  }, [socket, sessionId]);

  const sendMessage = useCallback(
    (content) => {
      if (!content.trim() || !socket) return;
      socket.emit('sendMessage', { sessionId, content });
    },
    [socket, sessionId]
  );

  return { messages, sendMessage };
}
