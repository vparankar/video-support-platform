import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { endSession } from '../api/api';
import { getServerUrl } from '../api/api';
import useMediasoup from '../hooks/useMediasoup';
import useChat from '../hooks/useChat';
import { resolveFileUrl } from '../api/api';
import VideoGrid from '../components/VideoGrid';
import ChatPanel from '../components/ChatPanel';
import Controls from '../components/Controls';

/**
 * CallRoom — main video-call page.
 *
 * Features:
 *   • mediasoup WebRTC via useMediasoup hook
 *   • real-time chat via useChat hook
 *   • agent-disconnect countdown overlay for customers
 *   • both roles can end the call
 */
export default function CallRoom() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── Socket (managed via ref so StrictMode remount creates a fresh one) ──
  // useMemo with [] would reuse the disconnected socket after StrictMode unmount.
  const socketRef = useRef(null);
  if (!socketRef.current || socketRef.current.disconnected) {
    socketRef.current = io(getServerUrl(), {
      transports: ['polling', 'websocket'],
    });
  }
  const socket = socketRef.current;

  // ── Hooks ─────────────────────────────────────────
  const {
    localStream,
    remoteStreams,
    isConnected,
    error,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
  } = useMediasoup(socket, sessionId, user?.id, user?.username, user?.role);

  const { messages, sendMessage, sendFileMessage } = useChat(socket, sessionId, user?.id, user?.username);

  // ── Recording (agent-only) ─────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState(null); // 'recording' | 'processing' | 'ready'
  const [recordingUrl, setRecordingUrl] = useState(null);

  const handleStartRecording = useCallback(() => {
    if (!socket || !sessionId) return;
    socket.emit('startRecording', { sessionId }, (response) => {
      if (response?.error) {
        console.error('Start recording error:', response.error);
      } else {
        setIsRecording(true);
      }
    });
  }, [socket, sessionId]);

  const handleStopRecording = useCallback(() => {
    if (!socket || !sessionId) return;
    socket.emit('stopRecording', { sessionId }, (response) => {
      if (response?.error) {
        console.error('Stop recording error:', response.error);
      } else {
        setIsRecording(false);
      }
    });
  }, [socket, sessionId]);

  // Listen for recording status events
  useEffect(() => {
    if (!socket) return;

    const onRecordingStatus = ({ status }) => {
      setRecordingStatus(status);
      if (status === 'recording') {
        setIsRecording(true);
      } else if (status !== 'recording') {
        setIsRecording(false);
      }
    };

    const onRecordingReady = ({ downloadUrl }) => {
      setRecordingUrl(downloadUrl);
    };

    socket.on('recordingStatus', onRecordingStatus);
    socket.on('recordingReady', onRecordingReady);

    return () => {
      socket.off('recordingStatus', onRecordingStatus);
      socket.off('recordingReady', onRecordingReady);
    };
  }, [socket]);

  // ── Agent-disconnect countdown (customer side) ────
  const [agentDisconnected, setAgentDisconnected] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!socket) return;

    const onAgentDisconnected = ({ timeoutSeconds }) => {
      setAgentDisconnected(true);
      setCountdown(timeoutSeconds || 60);
    };

    const onAgentReconnected = () => {
      setAgentDisconnected(false);
      setCountdown(60);
    };

    const onSessionEnded = () => {
      // Session force-ended (timeout or agent ended it)
      navigate(user?.role === 'agent' ? '/dashboard' : '/login');
    };

    socket.on('agentDisconnected', onAgentDisconnected);
    socket.on('agentReconnected', onAgentReconnected);
    socket.on('sessionEnded', onSessionEnded);

    return () => {
      socket.off('agentDisconnected', onAgentDisconnected);
      socket.off('agentReconnected', onAgentReconnected);
      socket.off('sessionEnded', onSessionEnded);
    };
  }, [socket, navigate, user?.role]);

  // Countdown timer when agent disconnects
  useEffect(() => {
    if (!agentDisconnected) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate('/login');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [agentDisconnected, navigate]);

  // ── End call handler ──────────────────────────────
  const handleEndCall = useCallback(async () => {
    try {
      if (user?.role === 'agent' || user?.role === 'admin') {
        await endSession(sessionId);
        socket.emit('endSession', { sessionId });
        navigate('/dashboard');
      } else {
        // Customer just leaves
        socket.disconnect();
        navigate('/login');
      }
    } catch (err) {
      console.error('End call error:', err);
      navigate(user?.role === 'agent' ? '/dashboard' : '/login');
    }
  }, [user, sessionId, socket, navigate]);

  // ── Disconnect socket on unmount ──────────────────
  useEffect(() => {
    const s = socketRef.current;
    return () => {
      if (s) s.disconnect();
    };
  }, []);

  // ── Loading state ─────────────────────────────────
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
        <p style={{ color: 'var(--red)', fontSize: '1.1rem' }}>{error}</p>
        <button
          style={styles.backBtn}
          onClick={() => navigate(user?.role === 'agent' ? '/dashboard' : '/login')}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="dark-theme" style={styles.page}>
      {/* ── Agent-disconnected overlay ─────────────── */}
      {agentDisconnected && (
        <div style={styles.overlay}>
          <div style={styles.overlayCard}>
            <div style={{ margin: '0 auto 12px', display: 'flex', justifyContent: 'center' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3 style={styles.overlayTitle}>Agent Disconnected</h3>
            <p style={styles.overlayText}>
              Waiting for the agent to reconnect…
            </p>
            <div style={styles.countdownCircle}>
              <span style={styles.countdownNum}>{countdown}</span>
              <span style={styles.countdownLabel}>seconds</span>
            </div>
            <p style={styles.overlayHint}>
              You will be redirected if the agent doesn't reconnect.
            </p>
          </div>
        </div>
      )}

      {/* ── Recording indicator banner ─────────────── */}
      {isRecording && (
        <div style={styles.recordingBanner}>
          <span style={styles.recordingDot} />
          <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: '0.82rem' }}>Recording in progress</span>
        </div>
      )}
      {recordingStatus === 'processing' && (
        <div style={{ ...styles.recordingBanner, background: 'var(--amber-bg)', borderBottom: '1px solid var(--amber-border)' }}>
          <span style={{ color: 'var(--amber)', fontWeight: 600, fontSize: '0.82rem' }}>Processing recording...</span>
        </div>
      )}
      {recordingUrl && recordingStatus === 'ready' && (
        <div style={{ ...styles.recordingBanner, background: 'var(--green-bg)', borderBottom: '1px solid var(--green-border)' }}>
          <span style={{ color: 'var(--green)', fontWeight: 600, fontSize: '0.82rem' }}>Recording ready — </span>
          <a href={resolveFileUrl(recordingUrl)} download style={{ color: 'var(--green)', textDecoration: 'underline', fontSize: '0.82rem', marginLeft: 4 }}>Download</a>
        </div>
      )}

      {/* ── Main layout ──────────────────────────── */}
      <div style={styles.body}>
        {/* Left: video grid */}
        <div style={styles.videoSection}>
          <VideoGrid
            localStream={localStream}
            remoteStreams={remoteStreams}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            localDisplayName={user?.username}
          />
        </div>

        {/* Right: chat panel */}
        <div style={styles.chatSection}>
          <ChatPanel
            messages={messages}
            sendMessage={sendMessage}
            sendFileMessage={sendFileMessage}
            sessionId={sessionId}
          />
        </div>
      </div>

      {/* Bottom controls */}
      <Controls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        toggleMute={toggleMute}
        toggleVideo={toggleVideo}
        onEndCall={handleEndCall}
        role={user?.role}
        onStartRecording={handleStartRecording}
        onStopRecording={handleStopRecording}
        isRecording={isRecording}
        recordingStatus={recordingStatus}
      />
    </div>
  );
}

// ── Inline styles ──────────────────────────────────
const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: 'var(--bg)',
    position: 'relative',
  },
  recordingBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '6px 16px',
    background: 'var(--red-bg)',
    borderBottom: '1px solid var(--red-border)',
    zIndex: 20,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: 'var(--red)',
    animation: 'recPulse 1.2s ease-in-out infinite',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  videoSection: {
    flex: 7,
    overflow: 'hidden',
  },
  chatSection: {
    flex: 3,
    minWidth: 280,
    maxWidth: 380,
  },
  loader: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: '3px solid var(--border-strong)',
    borderTopColor: 'var(--brand-yellow)',
    animation: 'spin 0.8s linear infinite',
  },
  backBtn: {
    marginTop: 18,
    padding: '0.55rem 1.4rem',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border-strong)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    transition: 'background 0.15s',
  },

  // ── Overlay ────────────────────────────────────
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
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '2.5rem 2rem',
    textAlign: 'center',
    maxWidth: 400,
    width: '90%',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-dropdown)',
  },
  overlayIcon: {
    fontSize: '2.5rem',
    marginBottom: 12,
  },
  overlayTitle: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: 8,
  },
  overlayText: {
    color: 'var(--text-muted)',
    fontSize: '0.88rem',
    marginBottom: 20,
  },
  countdownCircle: {
    width: 90,
    height: 90,
    borderRadius: '50%',
    border: '3px solid var(--red)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 18px',
  },
  countdownNum: {
    fontSize: '1.6rem',
    fontWeight: 700,
    color: 'var(--red)',
    lineHeight: 1,
  },
  countdownLabel: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  overlayHint: {
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
  },
};
