import { useEffect, useRef } from 'react';

/**
 * A single video tile — attaches stream to <video> via ref.
 */
function VideoTile({ stream, label, muted, isOff }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div style={styles.tile}>
      {isOff ? (
        <div style={styles.avatar}>
          <span style={styles.avatarText}>{label?.charAt(0)?.toUpperCase() || '?'}</span>
          <span style={styles.avatarName}>{label}</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          style={styles.video}
        />
      )}
      <div style={styles.label}>{label}</div>
    </div>
  );
}

/**
 * VideoGrid — displays local + remote video tiles in a CSS grid.
 */
export default function VideoGrid({ localStream, remoteStreams, isMuted, isVideoOff, localDisplayName }) {
  const remoteEntries = remoteStreams ? Array.from(remoteStreams.entries()) : [];

  return (
    <div style={styles.grid}>
      {/* Local tile */}
      <VideoTile
        stream={localStream}
        label="You"
        muted
        isOff={isVideoOff}
      />

      {/* Remote tiles */}
      {remoteEntries.map(([socketId, { stream, displayName }]) => (
        <VideoTile
          key={socketId}
          stream={stream}
          label={displayName}
          muted={false}
          isOff={false}
        />
      ))}
    </div>
  );
}

// ── Inline styles ──────────────────────────────────
const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    padding: '12px',
    maxHeight: 'calc(100vh - 160px)',
    overflowY: 'auto',
  },
  tile: {
    position: 'relative',
    background: '#0f172a',
    borderRadius: 14,
    overflow: 'hidden',
    aspectRatio: '16 / 9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #1e293b',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  label: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '6px 12px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
    color: '#f1f5f9',
    fontSize: '0.78rem',
    fontWeight: 500,
  },
  avatar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  avatarText: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#fff',
  },
  avatarName: {
    fontSize: '0.82rem',
    color: '#94a3b8',
  },
};
