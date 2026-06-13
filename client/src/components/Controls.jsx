/**
 * Controls — bottom toolbar for call actions.
 * Uses emoji icons to avoid any icon library dependency.
 */
export default function Controls({
  isMuted,
  isVideoOff,
  toggleMute,
  toggleVideo,
  onEndCall,
  role,
  onStartRecording,
  onStopRecording,
  isRecording,
  recordingStatus,
}) {
  const isProcessing = recordingStatus === 'processing';

  const handleHover = (e, isHovered, isActive, isEnd) => {
    if (isEnd) {
      e.currentTarget.style.background = isHovered ? '#b91c1c' : 'var(--red)';
    } else if (isActive) {
      e.currentTarget.style.background = isHovered ? 'var(--red-bg)' : 'var(--red-bg)';
    } else {
      e.currentTarget.style.background = isHovered ? 'var(--surface-raised)' : 'var(--bg)';
    }
  };

  return (
    <div style={styles.bar}>
      {/* Mic toggle */}
      <button
        style={{ ...styles.btn, ...(isMuted ? styles.btnActive : {}) }}
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
        onMouseEnter={(e) => handleHover(e, true, isMuted, false)}
        onMouseLeave={(e) => handleHover(e, false, isMuted, false)}
      >
        {isMuted ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="2" y1="2" x2="22" y2="22" />
            <path d="M18.89 13.23A7.12 7.12 0 0 0 19 11v-1" />
            <path d="M9 9v1a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 11v-1" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        )}
      </button>

      {/* Camera toggle */}
      <button
        style={{ ...styles.btn, ...(isVideoOff ? styles.btnActive : {}) }}
        onClick={toggleVideo}
        title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
        onMouseEnter={(e) => handleHover(e, true, isVideoOff, false)}
        onMouseLeave={(e) => handleHover(e, false, isVideoOff, false)}
      >
        {isVideoOff ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
            <path d="M5.6 2h8.4c1.1 0 2 .9 2 2v8.4M23 7l-7 5 7 5V7z" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        )}
      </button>

      {/* End call */}
      <button
        style={{ ...styles.btn, ...styles.endBtn }}
        onClick={onEndCall}
        title="End Call"
        onMouseEnter={(e) => handleHover(e, true, false, true)}
        onMouseLeave={(e) => handleHover(e, false, false, true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(135deg)', color: '#FFFFFF' }}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 2.6 3.4" />
        </svg>
      </button>

      {/* Record (agent only) */}
      {role === 'agent' && (
        <button
          style={{
            ...styles.btn,
            ...(isRecording ? styles.recording : {}),
            ...(isProcessing ? styles.processing : {}),
          }}
          onClick={isProcessing ? undefined : (isRecording ? onStopRecording : onStartRecording)}
          title={isProcessing ? 'Processing…' : isRecording ? 'Stop Recording' : 'Start Recording'}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <svg style={{ animation: 'spin 1s linear infinite', color: 'var(--amber)' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="12" y2="6" />
              <line x1="12" y1="18" x2="12" y2="22" />
              <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
              <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
              <line x1="2" y1="12" x2="6" y2="12" />
              <line x1="18" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
              <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--red)' }}>
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}

// ── Inline styles ──────────────────────────────────
const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: '14px 0',
    background: 'var(--surface)',
    borderTop: '1px solid var(--border)',
  },
  btn: {
    width: 46,
    height: 46,
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border-strong)',
    background: 'var(--bg)',
    fontSize: '1.25rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s, transform 0.15s',
  },
  btnActive: {
    background: 'var(--red-bg)',
    border: '1px solid var(--red-border)',
  },
  endBtn: {
    background: 'var(--red)',
    border: 'none',
  },
  recording: {
    animation: 'pulse 1.2s infinite',
    background: 'var(--red-bg)',
    border: '1px solid var(--red)',
  },
  processing: {
    opacity: 0.6,
    cursor: 'not-allowed',
    background: 'var(--amber-bg)',
    border: '1px solid var(--amber)',
  },
};
