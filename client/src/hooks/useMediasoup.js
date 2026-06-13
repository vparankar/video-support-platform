import { useState, useEffect, useRef, useCallback } from 'react';
import { Device } from 'mediasoup-client';

/**
 * useMediasoup — manages the full mediasoup WebRTC lifecycle.
 *
 * Uses Socket.io acknowledgement callbacks (not .once listeners) so that
 * every request-response pair is guaranteed 1:1 — no race conditions.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {string} sessionId
 * @param {number} userId
 * @param {string} displayName
 * @param {string} role
 */
export default function useMediasoup(socket, sessionId, userId, displayName, role) {
  // ── Public state ──────────────────────────────────
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // ── Internal refs ─────────────────────────────────
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const producersRef = useRef(new Map()); // kind -> producer
  const consumersRef = useRef(new Map()); // consumerId -> consumer
  const remoteStreamsRef = useRef(new Map()); // socketId -> {stream, displayName, role}
  const localStreamRef = useRef(null);

  // ── Helper: emit with ack callback (with timeout) ──
  const emitWithAck = useCallback((event, data, timeoutMs = 10000) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout waiting for ack on '${event}'`));
      }, timeoutMs);

      socket.emit(event, data, (response) => {
        clearTimeout(timer);
        if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  }, [socket]);

  // ── Consume a single remote producer ──────────────
  const consumeProducer = useCallback(async (producerSocketId, producerId, kind, appData) => {
    if (!deviceRef.current || !recvTransportRef.current) return;

    try {
      const consumerParams = await emitWithAck('consume', {
        sessionId,
        producerId,
        producerSocketId,
        rtpCapabilities: deviceRef.current.rtpCapabilities,
      });

      const consumer = await recvTransportRef.current.consume(consumerParams);
      consumersRef.current.set(consumer.id, consumer);

      // Emit resumeConsumer so server un-pauses the consumer
      socket.emit('resumeConsumer', { sessionId, consumerId: consumer.id });

      // Group tracks by producerSocketId — one MediaStream per peer
      const existing = remoteStreamsRef.current.get(producerSocketId);
      let stream;
      if (existing) {
        stream = existing.stream;
        stream.addTrack(consumer.track);
        if (kind === 'video') {
          existing.isVideoOff = false;
        }
      } else {
        stream = new MediaStream([consumer.track]);
      }

      remoteStreamsRef.current.set(producerSocketId, {
        stream,
        displayName: appData?.displayName || 'Peer',
        role: appData?.role || 'customer',
        isVideoOff: existing ? existing.isVideoOff : (kind !== 'video'),
      });

      // Flush to React state (new Map triggers re-render)
      setRemoteStreams(new Map(remoteStreamsRef.current));
    } catch (err) {
      console.error('[useMediasoup] consumeProducer error:', err);
    }
  }, [emitWithAck, sessionId, socket]);

  // ── Main init sequence ────────────────────────────
  useEffect(() => {
    if (!socket || !sessionId) return;

    let cancelled = false;

    async function waitForSocket() {
      if (socket.connected) return;
      // If socket was explicitly disconnected, reconnect it
      if (socket.disconnected) {
        socket.connect();
      }
      return new Promise((resolve, reject) => {
        const onConnect = () => {
          socket.off('connect_error', onError);
          resolve();
        };
        const onError = (err) => {
          socket.off('connect', onConnect);
          reject(new Error(`Socket connect error: ${err?.message}`));
        };
        socket.once('connect', onConnect);
        socket.once('connect_error', onError);
      });
    }

    async function initMediasoup() {
      try {
        // 0. Wait for socket to be connected
        await waitForSocket();
        if (cancelled) return;

        // 1. Get user media
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
        } catch (mediaErr) {
          console.warn('[useMediasoup] Failed to get video, falling back to audio-only', mediaErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: false,
            });
          } catch (audioErr) {
            console.warn('[useMediasoup] Failed to get audio, proceeding without media', audioErr);
            stream = new MediaStream();
          }
        }
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);

        // 2. Join room (ack callback)
        const token = localStorage.getItem('token');
        const joinResult = await emitWithAck('joinRoom', {
          sessionId, displayName, role, userId, token,
        });
        if (cancelled) return;
        setIsConnected(true);

        // 3. Get router RTP capabilities (ack callback)
        const { rtpCapabilities } = await emitWithAck(
          'getRouterRtpCapabilities',
          { sessionId }
        );
        if (cancelled) return;

        // 4. Create mediasoup Device
        const device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });
        deviceRef.current = device;

        // 5. Create SEND transport (ack callback)
        const sendParams = await emitWithAck('createWebRtcTransport', {
          sessionId, direction: 'send',
        });
        if (cancelled) return;

        const sendTransport = device.createSendTransport(sendParams);
        sendTransportRef.current = sendTransport;

        // Transport 'connect' — use ack callback
        sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          emitWithAck('connectWebRtcTransport', {
            sessionId,
            transportId: sendTransport.id,
            dtlsParameters,
          }).then(() => callback()).catch(errback);
        });

        // Transport 'produce' — use ack callback
        sendTransport.on('produce', ({ kind, rtpParameters, appData: pAppData }, callback, errback) => {
          emitWithAck('produce', {
            sessionId,
            transportId: sendTransport.id,
            kind,
            rtpParameters,
            appData: pAppData,
          }).then(({ producerId }) => callback({ id: producerId })).catch(errback);
        });

        // 6. Produce audio
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          const audioProducer = await sendTransport.produce({
            track: audioTrack,
            appData: { displayName },
          });
          producersRef.current.set('audio', audioProducer);
        }

        // 7. Produce video
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const videoProducer = await sendTransport.produce({
            track: videoTrack,
            appData: { displayName },
          });
          producersRef.current.set('video', videoProducer);
        }

        // 8. Create RECV transport (ack callback — no collision now!)
        const recvParams = await emitWithAck('createWebRtcTransport', {
          sessionId, direction: 'recv',
        });
        if (cancelled) return;

        const recvTransport = device.createRecvTransport(recvParams);
        recvTransportRef.current = recvTransport;

        recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
          emitWithAck('connectWebRtcTransport', {
            sessionId,
            transportId: recvTransport.id,
            dtlsParameters,
          }).then(() => callback()).catch(errback);
        });

        // 9. Now consume any existing producers from joinRoom
        if (joinResult?.existingProducers?.length) {
          for (const p of joinResult.existingProducers) {
            const peerSocketId = p.producerSocketId || p.socketId;
            await consumeProducer(peerSocketId, p.producerId, p.kind, p.appData);
          }
        }

      } catch (err) {
        console.error('[useMediasoup] init error:', err);
        if (!cancelled) setError(err.message || 'Failed to initialise media');
      }
    }

    initMediasoup();

    // ── Socket listeners ────────────────────────────
    // New producer from a peer
    const onNewProducer = ({ producerId, producerSocketId, kind, appData }) => {
      consumeProducer(producerSocketId, producerId, kind, appData);
    };

    // New peer joined (might not have producers yet)
    const onNewPeer = ({ socketId, displayName, role: peerRole }) => {
      if (!remoteStreamsRef.current.has(socketId)) {
        remoteStreamsRef.current.set(socketId, {
          stream: new MediaStream(),
          displayName,
          role: peerRole,
          isVideoOff: true,
        });
        setRemoteStreams(new Map(remoteStreamsRef.current));
      }
    };

    // Producer closed
    const onProducerClosed = ({ producerId, producerSocketId }) => {
      // Remove the consumer
      for (const [cid, consumer] of consumersRef.current.entries()) {
        if (consumer.producerId === producerId) {
          consumer.close();
          consumersRef.current.delete(cid);
        }
      }
      // Remove track from remote stream; if no tracks left, remove entry
      const entry = remoteStreamsRef.current.get(producerSocketId);
      if (entry) {
        const tracks = entry.stream.getTracks();
        if (tracks.length <= 1) {
          remoteStreamsRef.current.delete(producerSocketId);
        }
        setRemoteStreams(new Map(remoteStreamsRef.current));
      }
    };

    // Peer left entirely
    const onPeerLeft = ({ socketId }) => {
      remoteStreamsRef.current.delete(socketId);
      setRemoteStreams(new Map(remoteStreamsRef.current));
    };

    // Session ended by agent/server
    const onSessionEnded = () => {
      setIsConnected(false);
    };

    // Remote peer toggled video
    const onPeerVideoStateChanged = ({ socketId, isVideoOff }) => {
      const entry = remoteStreamsRef.current.get(socketId);
      if (entry) {
        entry.isVideoOff = isVideoOff;
        setRemoteStreams(new Map(remoteStreamsRef.current));
      }
    };

    socket.on('newPeer', onNewPeer);
    socket.on('newProducer', onNewProducer);
    socket.on('producerClosed', onProducerClosed);
    socket.on('peerLeft', onPeerLeft);
    socket.on('sessionEnded', onSessionEnded);
    socket.on('peerVideoStateChanged', onPeerVideoStateChanged);

    // ── Cleanup ─────────────────────────────────────
    return () => {
      cancelled = true;

      socket.off('newPeer', onNewPeer);
      socket.off('newProducer', onNewProducer);
      socket.off('producerClosed', onProducerClosed);
      socket.off('peerLeft', onPeerLeft);
      socket.off('sessionEnded', onSessionEnded);
      socket.off('peerVideoStateChanged', onPeerVideoStateChanged);

      // Close all producers
      producersRef.current.forEach((p) => { try { p.close(); } catch {} });
      producersRef.current.clear();

      // Close all consumers
      consumersRef.current.forEach((c) => { try { c.close(); } catch {} });
      consumersRef.current.clear();

      // Close transports
      try { sendTransportRef.current?.close(); } catch {}
      try { recvTransportRef.current?.close(); } catch {}

      // Stop local media tracks
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [socket, sessionId, userId, displayName, role, emitWithAck, consumeProducer]);

  // ── Toggle helpers ────────────────────────────────
  const toggleMute = useCallback(() => {
    const producer = producersRef.current.get('audio');
    if (!producer) return;
    if (producer.paused) {
      producer.resume();
      setIsMuted(false);
    } else {
      producer.pause();
      setIsMuted(true);
    }
  }, []);

  const toggleVideo = useCallback(async () => {
    const producer = producersRef.current.get('video');
    if (!producer) return;

    if (producer.paused) {
      try {
        // Re-acquire a fresh video track to avoid black frames
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = newStream.getVideoTracks()[0];

        // Replace the track on the producer (sends new track to SFU)
        await producer.replaceTrack({ track: newTrack });
        producer.resume();

        // Update the local stream so the local preview shows the new track
        const localStream = localStreamRef.current;
        if (localStream) {
          const oldTrack = localStream.getVideoTracks()[0];
          if (oldTrack) {
            localStream.removeTrack(oldTrack);
            oldTrack.stop();
          }
          localStream.addTrack(newTrack);
        }

        setIsVideoOff(false);
        socket.emit('toggleVideoState', { sessionId, isVideoOff: false });
      } catch (err) {
        console.error('[useMediasoup] Failed to re-acquire camera:', err);
      }
    } else {
      producer.pause();
      // Fully stop the track so the camera LED turns off
      const track = localStreamRef.current?.getVideoTracks()[0];
      if (track) {
        track.stop();
      }
      setIsVideoOff(true);
      socket.emit('toggleVideoState', { sessionId, isVideoOff: true });
    }
  }, [socket, sessionId]);

  return {
    localStream,
    remoteStreams,
    isConnected,
    error,
    isMuted,
    isVideoOff,
    toggleMute,
    toggleVideo,
  };
}
