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

  return (
    <div style={styles.bar}>
      {/* Mic toggle */}
      <button
        style={{ ...styles.btn, ...(isMuted ? styles.btnActive : {}) }}
        onClick={toggleMute}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? '🔇' : '🎤'}
      </button>

      {/* Camera toggle */}
      <button
        style={{ ...styles.btn, ...(isVideoOff ? styles.btnActive : {}) }}
        onClick={toggleVideo}
        title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
      >
        {isVideoOff ? '🚫' : '📷'}
      </button>

      {/* End call */}
      <button
        style={{ ...styles.btn, ...styles.endBtn }}
        onClick={onEndCall}
        title="End Call"
      >
        📞
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
          {isProcessing ? '⏳' : '🔴'}
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
    background: '#1e293b',
    borderTop: '1px solid #334155',
  },
  btn: {
    width: 50,
    height: 50,
    borderRadius: '50%',
    border: '1px solid #334155',
    background: '#0f172a',
    fontSize: '1.25rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s, transform 0.15s',
  },
  btnActive: {
    background: '#334155',
  },
  endBtn: {
    background: '#ef4444',
    border: 'none',
  },
  recording: {
    animation: 'pulse 1.2s infinite',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid #ef4444',
  },
  processing: {
    opacity: 0.6,
    cursor: 'not-allowed',
    background: 'rgba(245,158,11,0.15)',
    border: '1px solid #f59e0b',
  },
};
