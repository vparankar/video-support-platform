import { useState, useEffect, useRef } from 'react';
import { uploadFile } from '../api/api';

/**
 * ChatPanel — scrollable message list + input bar with file sharing.
 */
export default function ChatPanel({ messages, sendMessage, sendFileMessage, sessionId }) {
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

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

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { data } = await uploadFile(sessionId, file);
      sendFileMessage({ fileName: data.fileName, fileUrl: data.fileUrl });
    } catch (err) {
      console.error('File upload failed:', err);
      alert(err.response?.data?.error || 'File upload failed');
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * Determine an icon for the file based on extension.
   */
  const getFileIcon = (fileName) => {
    if (!fileName) return '📎';
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return '🖼️';
    if (ext === 'pdf') return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    if (ext === 'txt') return '📃';
    return '📎';
  };

  /**
   * Build a full URL for file downloads. The fileUrl from the server is
   * a root-relative path like `/uploads/filename`. In dev the Vite proxy
   * rewrites `/api` but not `/uploads`, so we need the server origin.
   */
  const resolveFileUrl = (fileUrl) => {
    if (!fileUrl) return '#';
    // Already absolute
    if (fileUrl.startsWith('http')) return fileUrl;
    // In production the same origin serves static files.
    // In dev, the Vite proxy is only for /api — resolve against server origin.
    return fileUrl;
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
        {messages.map((msg, i) => {
          const isFile = msg.type === 'file' || msg.message_type === 'file';
          const fileUrl = msg.fileUrl || msg.file_url;
          const fileName = msg.fileName || msg.file_name || msg.content;

          return (
            <div key={msg.id ?? i} style={styles.msg}>
              <span style={styles.name}>{msg.displayName || msg.display_name}</span>
              {isFile ? (
                <a
                  href={resolveFileUrl(fileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={fileName}
                  style={styles.fileLink}
                >
                  <span style={styles.fileBubble}>
                    <span style={styles.fileIcon}>{getFileIcon(fileName)}</span>
                    <span style={styles.fileName}>{fileName}</span>
                    <span style={styles.downloadIcon}>⬇</span>
                  </span>
                </a>
              ) : (
                <span style={styles.content}>{msg.content}</span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Upload progress */}
      {uploading && (
        <div style={styles.uploadBar}>
          <div style={styles.uploadSpinner} />
          <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>Uploading…</span>
        </div>
      )}

      {/* Input */}
      <div style={styles.inputRow}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        <button
          style={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          title="Attach file"
          disabled={uploading}
        >
          📎
        </button>
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
  // ── File message bubble ──────────────────────────
  fileLink: {
    textDecoration: 'none',
  },
  fileBubble: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#334155',
    border: '1px solid #475569',
    borderRadius: 10,
    padding: '6px 12px',
    marginTop: 2,
    transition: 'background 0.15s',
    cursor: 'pointer',
  },
  fileIcon: {
    fontSize: '1.05rem',
    flexShrink: 0,
  },
  fileName: {
    color: '#e2e8f0',
    fontSize: '0.82rem',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  downloadIcon: {
    color: '#6366f1',
    fontSize: '0.75rem',
    flexShrink: 0,
  },
  // ── Upload bar ───────────────────────────────────
  uploadBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    borderTop: '1px solid #334155',
    background: 'rgba(99,102,241,0.08)',
  },
  uploadSpinner: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '2px solid #475569',
    borderTopColor: '#6366f1',
    animation: 'spin 0.6s linear infinite',
  },
  // ── Input row ────────────────────────────────────
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: '10px 12px',
    borderTop: '1px solid #334155',
    background: '#1e293b',
  },
  attachBtn: {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #334155',
    background: '#0f172a',
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s, border-color 0.15s',
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
