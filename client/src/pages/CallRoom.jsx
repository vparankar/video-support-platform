import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { endSession } from '../api/api';
import { getServerUrl } from '../api/api';
import useMediasoup from '../hooks/useMediasoup';
import useChat from '../hooks/useChat';
import VideoGrid from '../components/VideoGrid';
import ChatPanel from '../components/ChatPanel';
import Controls from '../components/Controls';

/**
 * CallRoom — main video-call page.
 *
 * Layout: full-screen video with floating controls + togglable chat drawer.
 */
export default function CallRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Socket ──────────────────────────────────────
  const socketRef = useRef(null);
  if (!socketRef.current || socketRef.current.disconnected) {
    socketRef.current = io(getServerUrl(), {
      transports: ['polling', 'websocket'],
    });
  }
  const socket = socketRef.current;

  // ── Hooks ───────────────────────────────────────
  const {
    localStream,
    remoteStreams,
    isConnected,
    error,
    isMuted,
    isVideoOff,
    isScreenSharing,
    toggleMute,
    toggleVideo,
    toggleScreenShare,
  } = useMediasoup(socket, sessionId, user?.id, user?.username, user?.role);

  const { messages, sendMessage, sendFileMessage } = useChat(socket, sessionId, user?.id, user?.username, isConnected);

  // ── Chat toggle ─────────────────────────────────
  const [isChatOpen, setIsChatOpen] = useState(false);

  // ── Client-side recording ───────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const videoGridRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      const container = videoGridRef.current;
      if (!container) return;

      chunksRef.current = [];
      setRecordingUrl(null);

      const canvas = document.createElement('canvas');
      const rect = container.getBoundingClientRect();
      canvas.width = Math.floor(rect.width);
      canvas.height = Math.floor(rect.height);
      const ctx = canvas.getContext('2d');

      const paintInterval = setInterval(() => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const videos = container.querySelectorAll('video');
        videos.forEach((video) => {
          if (!video.srcObject || video.readyState < 2) return;
          const vRect = video.getBoundingClientRect();
          const x = vRect.left - rect.left;
          const y = vRect.top - rect.top;
          try { ctx.drawImage(video, x, y, vRect.width, vRect.height); } catch {}
        });
      }, 1000 / 15);

      const canvasStream = canvas.captureStream(15);

      try {
        const audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        container.querySelectorAll('video').forEach((video) => {
          if (video.srcObject) {
            try {
              const source = audioCtx.createMediaStreamSource(video.srcObject);
              source.connect(dest);
            } catch {}
          }
        });
        dest.stream.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
      } catch {}

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';

      const recorder = new MediaRecorder(canvasStream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        clearInterval(paintInterval);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordingUrl(URL.createObjectURL(blob));
        chunksRef.current = [];
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    }
  }, [isRecording]);

  // ── Agent-disconnect countdown ──────────────────
  const [agentDisconnected, setAgentDisconnected] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!socket) return;
    const onAgentDisconnected = ({ timeoutSeconds }) => { setAgentDisconnected(true); setCountdown(timeoutSeconds || 60); };
    const onAgentReconnected = () => { setAgentDisconnected(false); setCountdown(60); };
    const onSessionEnded = () => { navigate(user?.role === 'agent' ? '/dashboard' : '/login'); };

    socket.on('agentDisconnected', onAgentDisconnected);
    socket.on('agentReconnected', onAgentReconnected);
    socket.on('sessionEnded', onSessionEnded);
    return () => {
      socket.off('agentDisconnected', onAgentDisconnected);
      socket.off('agentReconnected', onAgentReconnected);
      socket.off('sessionEnded', onSessionEnded);
    };
  }, [socket, navigate, user?.role]);

  useEffect(() => {
    if (!agentDisconnected) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(interval); navigate('/login'); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [agentDisconnected, navigate]);

  // ── End call ────────────────────────────────────
  const handleEndCall = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    try {
      if (user?.role === 'agent' || user?.role === 'admin') {
        await endSession(sessionId);
        socket.emit('endSession', { sessionId });
        navigate('/dashboard');
      } else {
        socket.emit('customerLeaving', { sessionId });
        socket.disconnect();
        navigate('/login');
      }
    } catch (err) {
      console.error('End call error:', err);
      navigate(user?.role === 'agent' ? '/dashboard' : '/login');
    }
  }, [user, sessionId, socket, navigate]);

  // ── Cleanup ─────────────────────────────────────
  useEffect(() => {
    const s = socketRef.current;
    return () => { if (s) s.disconnect(); };
  }, []);

  // ── Loading / Error ─────────────────────────────
  if (!isConnected && !error) {
    return (
      <div style={styles.loader}>
        <div style={styles.spinner} />
        <p style={{ color: '#94a3b8', marginTop: 16 }}>Connecting to call…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.loader}>
        <p style={{ color: '#ef4444', fontSize: '1.1rem' }}>{error}</p>
        <button style={styles.backBtn} onClick={() => navigate(user?.role === 'agent' ? '/dashboard' : '/login')}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="dark-theme" style={styles.page}>
      {/* ── Agent-disconnected overlay ─── */}
      {agentDisconnected && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <div style={{ margin: '0 auto 12px', display: 'flex', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3 style={styles.overlayTitle}>Agent Disconnected</h3>
            <p style={styles.overlayText}>Waiting for the agent to reconnect…</p>
            <div style={styles.countdownCircle}>
              <span style={styles.countdownNum}>{countdown}</span>
              <span style={styles.countdownLabel}>seconds</span>
            </div>
            <p style={styles.overlayHint}>You will be redirected if the agent doesn't reconnect.</p>
          </div>
        </div>
      )}

      {/* ── Full-screen video area ─── */}
      <div style={styles.videoFull}>
        <VideoGrid
          ref={videoGridRef}
          localStream={localStream}
          remoteStreams={remoteStreams}
          isMuted={isMuted}
          isVideoOff={isVideoOff}
          localDisplayName={user?.username}
        />

        {/* ── Recording banner (floating top) ─── */}
        {isRecording && (
          <div style={styles.recordingBanner}>
            <span style={styles.recordingDot} />
            <span style={{ color: '#ef4444', fontWeight: 600, fontSize: '0.82rem' }}>Recording</span>
          </div>
        )}
        {recordingUrl && !isRecording && (
          <div style={{ ...styles.recordingBanner, background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.82rem' }}>Recording ready — </span>
            <a href={recordingUrl} download={`recording-${sessionId}.webm`} style={{ color: '#10b981', textDecoration: 'underline', fontSize: '0.82rem', marginLeft: 4 }}>Download</a>
            <button onClick={() => setRecordingUrl(null)} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.85rem' }}>✕</button>
          </div>
        )}

        {/* ── Chat toggle — top right ─── */}
        <button
          style={{ ...styles.floatingBtn, ...styles.chatToggle, ...(isChatOpen ? styles.chatToggleActive : {}) }}
          onClick={() => setIsChatOpen(c => !c)}
          title={isChatOpen ? 'Hide Chat' : 'Show Chat'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {messages.length > 0 && !isChatOpen && (
            <span style={styles.chatBadge}>{messages.length > 99 ? '99+' : messages.length}</span>
          )}
        </button>

        {/* ── Floating controls — bottom center ─── */}
        <div style={styles.controlsWrapper}>
          <Controls
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            toggleMute={toggleMute}
            toggleVideo={toggleVideo}
            onToggleScreenShare={toggleScreenShare}
            onEndCall={handleEndCall}
            role={user?.role}
            isRecording={isRecording}
            onToggleRecording={handleToggleRecording}
          />
        </div>
      </div>

      {/* ── Chat drawer (slides from right) ─── */}
      {isChatOpen && (
        <div style={styles.chatDrawer}>
          <ChatPanel
            messages={messages}
            sendMessage={sendMessage}
            sendFileMessage={sendFileMessage}
            sessionId={sessionId}
          />
        </div>
      )}
    </div>
  );
}

// ── Inline styles ──────────────────────────────────
const styles = {
  page: {
    display: 'flex',
    height: '100vh',
    background: '#1e1e2e',
    position: 'relative',
    overflow: 'hidden',
    padding: 6,
    gap: 6,
  },
  videoFull: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
  },

  // ── Floating controls at bottom center ──
  controlsWrapper: {
    position: 'absolute',
    bottom: 28,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 30,
  },

  // ── Floating button base ──
  floatingBtn: {
    width: 46,
    height: 46,
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    position: 'absolute',
    zIndex: 30,
  },

  // ── Chat toggle — top right ──
  chatToggle: {
    top: 16,
    right: 16,
  },
  chatToggleActive: {
    background: 'var(--brand-yellow)',
    border: '1px solid var(--brand-yellow)',
    color: '#111827',
  },
  chatBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    background: '#ef4444',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },

  // ── Recording banner (floating top center) ──
  recordingBanner: {
    position: 'absolute',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 16px',
    background: 'rgba(239,68,68,0.15)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 50,
    zIndex: 25,
    backdropFilter: 'blur(8px)',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#ef4444',
    animation: 'recPulse 1.2s ease-in-out infinite',
  },

  // ── Chat drawer ──
  chatDrawer: {
    width: 360,
    maxWidth: '85vw',
    height: '100%',
    flexShrink: 0,
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
    animation: 'slideInRight 0.2s ease-out',
    zIndex: 20,
  },

  // ── Loader ──
  loader: {
    minHeight: '100vh',
    background: '#09090b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '3px solid #3f3f46',
    borderTopColor: '#FDB913',
    animation: 'spin 0.8s linear infinite',
  },
  backBtn: {
    marginTop: 18,
    padding: '0.55rem 1.4rem',
    borderRadius: 8,
    border: '1px solid #3f3f46',
    background: 'transparent',
    color: '#a1a1aa',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
  },

  // ── Overlay ──
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 100,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayCard: {
    background: '#18181b',
    borderRadius: 12,
    padding: '2.5rem 2rem',
    textAlign: 'center',
    maxWidth: 400,
    width: '90%',
    border: '1px solid #27272a',
    boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
  },
  overlayTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#fafafa',
    marginBottom: 8,
  },
  overlayText: {
    color: '#a1a1aa',
    fontSize: '0.88rem',
    marginBottom: 20,
  },
  countdownCircle: {
    width: 90,
    height: 90,
    borderRadius: '50%',
    border: '3px solid #ef4444',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 18px',
  },
  countdownNum: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#ef4444',
    lineHeight: 1,
  },
  countdownLabel: {
    fontSize: '0.65rem',
    color: '#a1a1aa',
    marginTop: 2,
  },
  overlayHint: {
    color: '#a1a1aa',
    fontSize: '0.78rem',
  },
};
