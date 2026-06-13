import { useState, useEffect, useRef } from 'react';
import { uploadFile, resolveFileUrl } from '../api/api';

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
    const defaultIcon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
    );
    if (!fileName) return defaultIcon;
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    }
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'].includes(ext)) {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    }
    return defaultIcon;
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
                    <span style={styles.downloadIcon}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                    </span>
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
          onMouseEnter={e => e.target.style.background = 'var(--surface-raised)'}
          onMouseLeave={e => e.target.style.background = 'var(--bg)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <input
          style={styles.input}
          type="text"
          placeholder="Type a message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          style={styles.sendBtn}
          onClick={handleSend}
          title="Send"
          onMouseEnter={e => e.target.style.background = 'var(--brand-yellow-dark)'}
          onMouseLeave={e => e.target.style.background = 'var(--brand-yellow)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#111827' }}>
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
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
    background: 'var(--surface)',
    borderLeft: '1px solid var(--border)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 16px',
    fontSize: '0.9rem',
    fontWeight: 600,
    color: 'var(--text)',
    borderBottom: '1px solid var(--border)',
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--green)',
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
    color: 'var(--text-muted)',
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
    color: 'var(--brand-yellow)',
    marginRight: 6,
  },
  content: {
    color: 'var(--text)',
  },
  // ── File message bubble ──────────────────────────
  fileLink: {
    textDecoration: 'none',
  },
  fileBubble: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius)',
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
    color: 'var(--text)',
    fontSize: '0.82rem',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  downloadIcon: {
    color: 'var(--brand-yellow)',
    fontSize: '0.75rem',
    flexShrink: 0,
  },
  // ── Upload bar ───────────────────────────────────
  uploadBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    borderTop: '1px solid var(--border)',
    background: 'var(--blue-bg)',
  },
  uploadSpinner: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '2px solid var(--border-strong)',
    borderTopColor: 'var(--blue)',
    animation: 'spin 0.6s linear infinite',
  },
  // ── Input row ────────────────────────────────────
  inputRow: {
    display: 'flex',
    gap: 8,
    padding: '10px 12px',
    borderTop: '1px solid var(--border)',
    background: 'var(--surface)',
  },
  attachBtn: {
    padding: '8px 10px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border-strong)',
    background: 'var(--bg)',
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
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border-strong)',
    background: 'var(--bg)',
    color: 'var(--text)',
    fontSize: '0.84rem',
    outline: 'none',
    fontFamily: 'inherit',
  },
  sendBtn: {
    padding: '8px 14px',
    borderRadius: 'var(--radius)',
    border: 'none',
    background: 'var(--brand-yellow)',
    color: '#111827',
    fontSize: '1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
};
