import { useEffect, useRef, useState, useCallback, forwardRef } from 'react';

/**
 * A single video tile — attaches stream to <video> via ref.
 */
function VideoTile({ stream, label, muted, isOff, style, labelStyle }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;

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
 * VideoGrid — 1-on-1 video call layout with click-to-swap.
 * Remote fills the view, local is a small PiP overlay.
 * Clicking PiP swaps local↔remote.
 */
const VideoGrid = forwardRef(function VideoGrid({ localStream, remoteStreams, isMuted, isVideoOff, localDisplayName }, ref) {
  const remoteEntries = remoteStreams ? Array.from(remoteStreams.entries()) : [];
  const hasRemote = remoteEntries.length > 0;

  const [swapped, setSwapped] = useState(false);

  const [pipPos, setPipPos] = useState({ x: 16, y: 16 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const didDrag = useRef(false);

  const setRefs = useCallback((node) => {
    containerRef.current = node;
    if (ref) {
      if (typeof ref === 'function') ref(node);
      else ref.current = node;
    }
  }, [ref]);

  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    didDrag.current = false;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current || !containerRef.current) return;
    didDrag.current = true;
    const bounds = containerRef.current.getBoundingClientRect();
    const pipW = 180, pipH = 135;
    let x = e.clientX - bounds.left - dragOffset.current.x;
    let y = e.clientY - bounds.top - dragOffset.current.y;
    x = Math.max(8, Math.min(bounds.width - pipW - 8, x));
    y = Math.max(8, Math.min(bounds.height - pipH - 8, y));
    setPipPos({ x, y });
  }, []);

  const onPointerUp = useCallback(() => {
    const wasDrag = didDrag.current;
    dragging.current = false;
    didDrag.current = false;
    if (!wasDrag) setSwapped(s => !s);
  }, []);

  const remoteData = hasRemote ? remoteEntries[0] : null;
  const bigStream = swapped ? localStream : remoteData?.[1]?.stream;
  const bigLabel = swapped ? (localDisplayName || 'You') : remoteData?.[1]?.displayName;
  const bigMuted = swapped;
  const bigIsOff = swapped ? isVideoOff : remoteData?.[1]?.isVideoOff;
  const pipStream = swapped ? remoteData?.[1]?.stream : localStream;
  const pipLabel = swapped ? remoteData?.[1]?.displayName : 'You';
  const pipMuted2 = !swapped;
  const pipIsOff = swapped ? remoteData?.[1]?.isVideoOff : isVideoOff;

  return (
    <div ref={setRefs} style={styles.container}>
      {hasRemote ? (
        <div style={styles.remoteTile} onClick={() => swapped && setSwapped(false)}>
          {bigIsOff ? (
            <div style={styles.avatar}>
              <span style={styles.avatarText}>{bigLabel?.charAt(0)?.toUpperCase() || '?'}</span>
              <span style={styles.avatarName}>{bigLabel}</span>
            </div>
          ) : (
            <VideoTile
              stream={bigStream}
              label={bigLabel}
              muted={bigMuted}
              isOff={false}
              style={styles.fullInner}
              labelStyle={styles.remoteLabel}
            />
          )}
          {bigIsOff && <div style={styles.remoteLabel}>{bigLabel}</div>}
        </div>
      ) : (
        <div style={styles.waiting}>
          <div style={styles.waitingDot} />
          <span style={styles.waitingText}>Waiting for the other person to join…</span>
        </div>
      )}

      {/* PiP overlay */}
      <div
        style={{ ...styles.pipTile, left: pipPos.x, top: pipPos.y }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {pipIsOff ? (
          <div style={styles.pipAvatar}>
            <span style={styles.pipAvatarText}>
              {pipLabel?.charAt(0)?.toUpperCase() || 'Y'}
            </span>
          </div>
        ) : (
          <VideoTile
            stream={pipStream}
            label={pipLabel}
            muted={pipMuted2}
            isOff={false}
            style={styles.pipInner}
            labelStyle={styles.pipLabel}
          />
        )}
        {pipIsOff && <div style={styles.pipLabel}>{pipLabel}</div>}
      </div>
    </div>
  );
});

export default VideoGrid;

const styles = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#0a0a0a',
    overflow: 'hidden',
  },
  remoteTile: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
    cursor: 'pointer',
  },
  fullInner: {
    width: '100%',
    height: '100%',
    position: 'relative',
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
  pipTile: {
    position: 'absolute',
    width: 180,
    height: 135,
    borderRadius: 12,
    overflow: 'hidden',
    border: '2px solid rgba(255,255,255,0.15)',
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
