/**
 * Controls — floating pill overlay for call actions.
 * Rendered as a translucent bar hovering over the video.
 */
export default function Controls({
  isMuted,
  isVideoOff,
  isScreenSharing,
  toggleMute,
  toggleVideo,
  onToggleScreenShare,
  onEndCall,
  role,
  isRecording,
  onToggleRecording,
}) {
  return (
    <div style={styles.bar}>
      {/* Mic toggle */}
      <button
        style={{ ...styles.btn, ...(isMuted ? styles.btnActive : {}) }}
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
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

      {/* Screen share (hidden on devices without getDisplayMedia, e.g. phones) */}
      {navigator.mediaDevices?.getDisplayMedia && (
        <button
          style={{ ...styles.btn, ...(isScreenSharing ? styles.btnScreenShare : {}) }}
          onClick={onToggleScreenShare}
          title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
        >
          {isScreenSharing ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="2" y1="2" x2="22" y2="22" />
              <path d="M17 3H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
              <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          )}
        </button>
      )}

      {/* End call */}
      <button
        style={{ ...styles.btn, ...styles.endBtn }}
        onClick={onEndCall}
        title="End Call"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(135deg)', color: '#fff' }}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 2.6 3.4" />
        </svg>
      </button>

      {/* Record (agent only) */}
      {role === 'agent' && (
        <button
          style={{ ...styles.btn, ...(isRecording ? styles.recording : {}) }}
          onClick={onToggleRecording}
          title={isRecording ? 'Stop Recording' : 'Start Recording'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: isRecording ? '#fff' : 'var(--red)' }}>
            <circle cx="12" cy="12" r="10" />
            {isRecording ? (
              <rect x="9" y="9" width="6" height="6" fill="currentColor" rx="1" />
            ) : (
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}

const styles = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 18px',
    background: 'rgba(0, 0, 0, 0.55)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderRadius: 50,
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  btn: {
    width: 46,
    height: 46,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: '1.25rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s, transform 0.15s',
  },
  btnActive: {
    background: 'rgba(239, 68, 68, 0.35)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
  },
  endBtn: {
    background: '#ef4444',
    border: 'none',
    width: 52,
    height: 52,
  },
  recording: {
    animation: 'pulse 1.2s infinite',
    background: 'rgba(239, 68, 68, 0.6)',
    border: '1px solid rgba(239, 68, 68, 0.8)',
  },
  btnScreenShare: {
    background: 'rgba(59, 130, 246, 0.35)',
    border: '1px solid rgba(59, 130, 246, 0.5)',
  },
};
