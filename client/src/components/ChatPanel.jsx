import { useState, useEffect, useRef } from 'react';

/**
 * ChatPanel — scrollable message list + input bar.
 */
export default function ChatPanel({ messages, sendMessage, sessionId }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerDot} />
        Chat
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>No messages yet…</div>
        )}
        {messages.map((msg, i) => (
          <div key={msg.id ?? i} style={styles.msg}>
            <span style={styles.name}>{msg.displayName || msg.display_name}</span>
            <span style={styles.content}>{msg.content}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          type="text"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button style={styles.sendBtn} onClick={handleSend} title="Send">
          ➤
        </button>
      </div>
    </div>
  );
}

// ── Inline styles ──────────────────────────────────
const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#1e293b',
    borderLeft: '1px solid #334155',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 16px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#f1f5f9',
    borderBottom: '1px solid #334155',
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#22c55e',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  empty: {
    color: '#475569',
    textAlign: 'center',
    marginTop: '2rem',
    fontSize: '0.82rem',
  },
  msg: {
    fontSize: '0.84rem',
    lineHeight: 1.45,
  },
  name: {
    fontWeight: 600,
    color: '#818cf8',
    marginRight: 6,
  },
  content: {
    color: '#cbd5e1',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: '10px 12px',
    borderTop: '1px solid #334155',
    background: '#1e293b',
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f1f5f9',
    fontSize: '0.84rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  sendBtn: {
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    background: '#6366f1',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
