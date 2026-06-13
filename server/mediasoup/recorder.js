const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const dgram = require('dgram');

/**
 * Grab an available UDP port on 127.0.0.1.
 * Binds a throwaway socket, reads the OS-assigned port, then closes it.
 */
function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const sock = dgram.createSocket('udp4');
    sock.bind(0, '127.0.0.1', () => {
      const { port } = sock.address();
      sock.close(() => resolve(port));
    });
    sock.on('error', reject);
  });
}

/**
 * Recorder — uses mediasoup PlainTransport to tap into active producers
 * and pipe their RTP streams to FFmpeg for recording to MP4.
 */
class Recorder {
  constructor() {
    // sessionId -> { process, transports[], consumers[], filePath, sdpPath }
    this.recordings = new Map();
  }

  /**
   * Start recording a session.
   *
   * @param {import('mediasoup').types.Router} router
   * @param {string} sessionId
   * @param {Array<{ producer: import('mediasoup').types.Producer, kind: string }>} producers
   * @returns {Promise<{ recordingId: string }>}
   */
  async startRecording(router, sessionId, producers) {
    // Prevent double-recording
    if (this.recordings.has(sessionId)) {
      console.warn(`[Recorder] Already recording session ${sessionId}`);
      return { recordingId: sessionId };
    }

    // Ensure output directory exists
    const recordingsDir = path.join(__dirname, '..', 'uploads', 'recordings');
    if (!fs.existsSync(recordingsDir)) {
      fs.mkdirSync(recordingsDir, { recursive: true });
    }

    const filePath = path.join(recordingsDir, `${sessionId}.mp4`);
    const transports = [];
    const consumers = [];

    // These are the ports FFmpeg will LISTEN on (separate from mediasoup's ports)
    let audioRtpPort = null;
    let audioRtcpPort = null;
    let videoRtpPort = null;
    let videoRtcpPort = null;

    // Create a PlainTransport + consumer for each producer
    for (const { producer, kind } of producers) {
      try {
        const plainTransport = await router.createPlainTransport({
          listenIp: { ip: '127.0.0.1' },
          rtcpMux: false,
          comedia: false,
        });

        transports.push(plainTransport);

        // Allocate separate free ports for FFmpeg to receive RTP/RTCP on
        const remoteRtpPort = await getAvailablePort();
        const remoteRtcpPort = await getAvailablePort();

        // Tell mediasoup WHERE to send the RTP stream (→ FFmpeg's listening ports)
        await plainTransport.connect({
          ip: '127.0.0.1',
          port: remoteRtpPort,
          rtcpPort: remoteRtcpPort,
        });

        const consumer = await plainTransport.consume({
          producerId: producer.id,
          rtpCapabilities: router.rtpCapabilities,
          paused: true, // Start paused, we will resume after FFmpeg starts
        });

        consumers.push(consumer);

        if (kind === 'audio') {
          audioRtpPort = remoteRtpPort;
          audioRtcpPort = remoteRtcpPort;
        } else if (kind === 'video') {
          videoRtpPort = remoteRtpPort;
          videoRtcpPort = remoteRtcpPort;
        }

        console.log(
          `[Recorder] ${kind} transport: mediasoup port ${plainTransport.tuple.localPort}` +
          ` → FFmpeg port ${remoteRtpPort} (rtcp: ${remoteRtcpPort})`
        );
      } catch (err) {
        console.error(`[Recorder] Failed to create transport for ${kind}:`, err);
      }
    }

    // We need at least one track to record
    if (!audioRtpPort && !videoRtpPort) {
      console.error('[Recorder] No producers to record');
      for (const t of transports) { try { t.close(); } catch {} }
      throw new Error('No audio or video producers available for recording');
    }

    // ── Build SDP for FFmpeg input ──
    // The ports in the SDP are the ones FFmpeg will LISTEN on.
    const sdpLines = [
      'v=0',
      'o=- 0 0 IN IP4 127.0.0.1',
      's=Recording',
      'c=IN IP4 127.0.0.1',
      't=0 0',
    ];

    // Audio SDP section
    if (audioRtpPort) {
      const audioConsumer = consumers.find(c => c.kind === 'audio');
      const audioCodec = audioConsumer?.rtpParameters?.codecs?.[0];
      const audioPayloadType = audioCodec?.payloadType || 111;
      const audioClockRate = audioCodec?.clockRate || 48000;
      const audioChannels = audioCodec?.channels || 2;
      const audioMime = audioCodec?.mimeType?.split('/')?.[1]?.toLowerCase() || 'opus';

      sdpLines.push(`m=audio ${audioRtpPort} RTP/AVP ${audioPayloadType}`);
      if (audioRtcpPort) {
        sdpLines.push(`a=rtcp:${audioRtcpPort}`);
      }
      sdpLines.push(`a=rtpmap:${audioPayloadType} ${audioMime}/${audioClockRate}/${audioChannels}`);
      if (audioMime === 'opus') {
        sdpLines.push(`a=fmtp:${audioPayloadType} minptime=10;useinbandfec=1`);
      }
      sdpLines.push('a=recvonly');
    }

    // Video SDP section
    if (videoRtpPort) {
      const videoConsumer = consumers.find(c => c.kind === 'video');
      const videoCodec = videoConsumer?.rtpParameters?.codecs?.[0];
      const videoPayloadType = videoCodec?.payloadType || 96;
      const videoClockRate = videoCodec?.clockRate || 90000;
      const videoMime = videoCodec?.mimeType?.split('/')?.[1]?.toUpperCase() || 'VP8';

      sdpLines.push(`m=video ${videoRtpPort} RTP/AVP ${videoPayloadType}`);
      if (videoRtcpPort) {
        sdpLines.push(`a=rtcp:${videoRtcpPort}`);
      }
      sdpLines.push(`a=rtpmap:${videoPayloadType} ${videoMime}/${videoClockRate}`);

      // Add profile-level-id for H264
      if (videoMime === 'H264') {
        const profileLevelId = videoCodec?.parameters?.['profile-level-id'] || '4d0032';
        const packetizationMode = videoCodec?.parameters?.['packetization-mode'] || 1;
        sdpLines.push(
          `a=fmtp:${videoPayloadType} profile-level-id=${profileLevelId};packetization-mode=${packetizationMode}`
        );
      }
      sdpLines.push('a=recvonly');
    }

    const sdpContent = sdpLines.join('\r\n') + '\r\n';

    // Write SDP to a temp file
    const sdpPath = path.join(recordingsDir, `${sessionId}.sdp`);
    fs.writeFileSync(sdpPath, sdpContent);

    console.log(`[Recorder] SDP written to ${sdpPath}`);
    console.log(`[Recorder] SDP content:\n${sdpContent}`);

    // ── Build FFmpeg command ──
    const ffmpegArgs = [
      '-loglevel', 'info', // Changed to info to see what's happening
      '-protocol_whitelist', 'file,udp,rtp',
      '-analyzeduration', '1000000', // Speed up probe (1 second)
      '-probesize', '1000000',
      '-fflags', '+genpts',
      '-i', sdpPath,
    ];

    // Output encoding: transcode to ensure container compatibility
    if (audioRtpPort && videoRtpPort) {
      ffmpegArgs.push(
        '-map', '0:a?',
        '-map', '0:v?',
        '-c:a', 'aac',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
      );
    } else if (audioRtpPort) {
      ffmpegArgs.push('-c:a', 'aac');
    } else {
      ffmpegArgs.push(
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-an',
      );
    }

    ffmpegArgs.push(
      '-f', 'mp4',
      '-movflags', '+frag_keyframe+empty_moov',
      '-y',
      filePath,
    );

    console.log(`[Recorder] Starting FFmpeg: ffmpeg ${ffmpegArgs.join(' ')}`);

    const ffmpegProcess = spawn('ffmpeg', ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    ffmpegProcess.stderr.on('data', (data) => {
      console.log(`[Recorder/FFmpeg] ${data.toString().trim()}`);
    });

    ffmpegProcess.on('error', (err) => {
      console.error(`[Recorder] FFmpeg process error:`, err);
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`[Recorder] FFmpeg exited with code ${code} for session ${sessionId}`);
    });

    // Wait a bit for FFmpeg to start listening, then resume consumers and request a keyframe
    setTimeout(async () => {
      for (const consumer of consumers) {
        try {
          await consumer.resume();
          if (consumer.kind === 'video') {
            await consumer.requestKeyFrame();
            console.log(`[Recorder] Resumed and requested keyframe for video consumer ${consumer.id}`);
          } else {
            console.log(`[Recorder] Resumed audio consumer ${consumer.id}`);
          }
        } catch (err) {
          console.error(`[Recorder] Error resuming consumer ${consumer.id}:`, err);
        }
      }
    }, 1000);

    // Store references
    this.recordings.set(sessionId, {
      process: ffmpegProcess,
      transports,
      consumers,
      filePath,
      sdpPath,
    });

    console.log(`[Recorder] Recording started for session ${sessionId}`);
    return { recordingId: sessionId };
  }

  /**
   * Stop recording a session.
   *
   * @param {string} sessionId
   * @returns {Promise<{ filePath: string } | null>}
   */
  stopRecording(sessionId) {
    const recording = this.recordings.get(sessionId);
    if (!recording) {
      console.warn(`[Recorder] No active recording for session ${sessionId}`);
      return Promise.resolve(null);
    }

    const { process: ffmpegProcess, transports, consumers, filePath, sdpPath } = recording;
    this.recordings.delete(sessionId);

    // Return a Promise that resolves once FFmpeg actually exits
    return new Promise((resolve) => {
      let resolved = false;
      let safetyTimer = null;

      const finish = (reason) => {
        if (resolved) return;
        resolved = true;
        if (safetyTimer) clearTimeout(safetyTimer);

        // Now clean up mediasoup resources
        for (const consumer of consumers) {
          try { consumer.close(); } catch {}
        }
        for (const transport of transports) {
          try { transport.close(); } catch {}
        }

        // Remove SDP temp file
        try { fs.unlinkSync(sdpPath); } catch {}

        console.log(`[Recorder] Recording stopped (${reason}) for session ${sessionId}: ${filePath}`);
        resolve({ filePath });
      };

      // If process already exited or was never started properly
      if (!ffmpegProcess || ffmpegProcess.exitCode !== null || ffmpegProcess.killed) {
        return finish('already-exited');
      }

      ffmpegProcess.once('close', (code) => finish(`exit-code-${code}`));

      // Graceful stop: send 'q' to FFmpeg stdin (works cross-platform).
      // FFmpeg will flush buffers and finalize the output file.
      try {
        if (ffmpegProcess.stdin && !ffmpegProcess.stdin.destroyed) {
          ffmpegProcess.stdin.write('q\n');
          ffmpegProcess.stdin.end();
        } else {
          // Fallback: kill the process directly
          ffmpegProcess.kill();
        }
      } catch (err) {
        console.error('[Recorder] Error stopping FFmpeg:', err);
        return finish('kill-error');
      }

      // Safety net: force-resolve after 10 s
      safetyTimer = setTimeout(() => {
        console.warn('[Recorder] Safety timeout — force-resolving for session', sessionId);
        try { ffmpegProcess.kill(); } catch {}
        finish('timeout');
      }, 10000);
    });
  }

  /**
   * Check if a session is currently being recorded.
   */
  isRecording(sessionId) {
    return this.recordings.has(sessionId);
  }

  /**
   * Clean up all recordings (on shutdown).
   */
  cleanup() {
    for (const [sessionId] of this.recordings) {
      this.stopRecording(sessionId);
    }
  }
}

module.exports = new Recorder();
