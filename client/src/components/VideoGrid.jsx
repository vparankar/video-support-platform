import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * A single video tile — attaches stream to <video> via ref.
 */
function VideoTile({ stream, label, muted, isOff, style, labelStyle }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;

    // When tracks are added/removed (e.g. camera toggle), re-attach
    const onTrackChange = () => {
      el.srcObject = null;
      el.srcObject = stream;
    };
    stream.addEventListener('addtrack', onTrackChange);
    stream.addEventListener('removetrack', onTrackChange);
    return () => {
      stream.removeEventListener('addtrack', onTrackChange);
      stream.removeEventListener('removetrack', onTrackChange);
    };
  }, [stream, isOff]);

  return (
    <div style={style || styles.remoteTile}>
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
      <div style={labelStyle || styles.remoteLabel}>{label}</div>
    </div>
  );
}

/**
 * VideoGrid — WhatsApp-style 1-on-1 video call layout.
 * Remote video fills the view, local video is a small PiP overlay.
 */
export default function VideoGrid({ localStream, remoteStreams, isMuted, isVideoOff, localDisplayName }) {
  const remoteEntries = remoteStreams ? Array.from(remoteStreams.entries()) : [];
  const hasRemote = remoteEntries.length > 0;

  // Draggable PiP state
  const [pipPos, setPipPos] = useState({ x: 16, y: 16 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const pipW = 140, pipH = 105;
    let x = e.clientX - bounds.left - dragOffset.current.x;
    let y = e.clientY - bounds.top - dragOffset.current.y;
    x = Math.max(8, Math.min(bounds.width - pipW - 8, x));
    y = Math.max(8, Math.min(bounds.height - pipH - 8, y));
    setPipPos({ x, y });
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div ref={containerRef} style={styles.container}>
      {/* Remote video (full area) */}
      {hasRemote ? (
        (() => {
          const [socketId, { stream, displayName, isVideoOff }] = remoteEntries[0];
          return (
            <VideoTile
              key={socketId}
              stream={stream}
              label={displayName}
              muted={false}
              isOff={isVideoOff}
              style={styles.remoteTile}
              labelStyle={styles.remoteLabel}
            />
          );
        })()
      ) : (
        <div style={styles.waiting}>
          <div style={styles.waitingDot} />
          <span style={styles.waitingText}>Waiting for the other person to join…</span>
        </div>
      )}

      {/* Local PiP overlay */}
      <div
        style={{
          ...styles.pipTile,
          left: pipPos.x,
          top: pipPos.y,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {isVideoOff ? (
          <div style={styles.pipAvatar}>
            <span style={styles.pipAvatarText}>
              {localDisplayName?.charAt(0)?.toUpperCase() || 'Y'}
            </span>
          </div>
        ) : (
          <VideoTile
            stream={localStream}
            label="You"
            muted
            isOff={false}
            style={styles.pipInner}
            labelStyle={styles.pipLabel}
          />
        )}
        {isVideoOff && <div style={styles.pipLabel}>You</div>}
      </div>
    </div>
  );
}

// ── Inline styles ──────────────────────────────────
const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#0a0a0a',
    overflow: 'hidden',
  },

  // Remote: fills entire area
  remoteTile: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  remoteLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '8px 16px',
    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: 600,
  },

  // Local PiP
  pipTile: {
    position: 'absolute',
    width: 140,
    height: 105,
    borderRadius: 12,
    overflow: 'hidden',
    border: '2px solid rgba(255,255,255,0.2)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    cursor: 'grab',
    zIndex: 10,
    background: '#1a1a2e',
    touchAction: 'none',
  },
  pipInner: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  pipLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '3px 8px',
    background: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: '0.7rem',
    fontWeight: 600,
    textAlign: 'center',
  },
  pipAvatar: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipAvatarText: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'var(--brand-yellow)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.1rem',
    fontWeight: 700,
    color: '#111827',
  },

  // Waiting state (no remote)
  waiting: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    background: '#111',
  },
  waitingDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: 'var(--brand-yellow)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  waitingText: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
  },

  // Avatar fallback (remote video off)
  avatar: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  avatarText: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'var(--brand-yellow)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '2rem',
    fontWeight: 700,
    color: '#111827',
  },
  avatarName: {
    fontSize: '1rem',
    color: 'var(--text-muted)',
  },
};
