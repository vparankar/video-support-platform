const mediasoup = require('mediasoup');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Recorder — uses mediasoup PlainTransport to tap into active producers
 * and pipe their RTP streams to FFmpeg for recording to MP4.
 */
class Recorder {
  constructor() {
    // sessionId -> { process, transports[], consumers[], filePath }
    this.recordings = new Map();
  }

  /**
   * Start recording a session.
   *
   * @param {import('mediasoup').types.Router} router
   * @param {string} sessionId
   * @param {Map<string, import('mediasoup').types.Producer>} producers - array of { producer, kind }
   * @returns {{ recordingId: string }}
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

    let audioPort = null;
    let audioRtcpPort = null;
    let videoPort = null;
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

        const consumer = await plainTransport.consume({
          producerId: producer.id,
          rtpCapabilities: router.rtpCapabilities,
          paused: false,
        });

        consumers.push(consumer);

        const port = plainTransport.tuple.localPort;
        const rtcpPort = plainTransport.rtcpTuple?.localPort;

        if (kind === 'audio') {
          audioPort = port;
          audioRtcpPort = rtcpPort;
        } else if (kind === 'video') {
          videoPort = port;
          videoRtcpPort = rtcpPort;
        }

        console.log(`[Recorder] ${kind} transport created on port ${port} (rtcp: ${rtcpPort})`);
      } catch (err) {
        console.error(`[Recorder] Failed to create transport for ${kind}:`, err);
      }
    }

    // Build SDP content for FFmpeg input
    const sdpLines = [
      'v=0',
      'o=- 0 0 IN IP4 127.0.0.1',
      's=Recording',
      'c=IN IP4 127.0.0.1',
      't=0 0',
    ];

    // We need at least one track to record
    if (!audioPort && !videoPort) {
      console.error('[Recorder] No producers to record');
      // Clean up
      for (const t of transports) { try { t.close(); } catch {} }
      throw new Error('No audio or video producers available for recording');
    }

    // Audio SDP section
    if (audioPort) {
      // Get audio consumer RTP parameters
      const audioConsumer = consumers.find(c => c.kind === 'audio');
      const audioCodec = audioConsumer?.rtpParameters?.codecs?.[0];
      const audioPayloadType = audioCodec?.payloadType || 111;
      const audioClockRate = audioCodec?.clockRate || 48000;
      const audioChannels = audioCodec?.channels || 2;
      const audioMime = audioCodec?.mimeType?.split('/')?.[1]?.toUpperCase() || 'opus';

      sdpLines.push(`m=audio ${audioPort} RTP/AVP ${audioPayloadType}`);
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
    if (videoPort) {
      const videoConsumer = consumers.find(c => c.kind === 'video');
      const videoCodec = videoConsumer?.rtpParameters?.codecs?.[0];
      const videoPayloadType = videoCodec?.payloadType || 96;
      const videoClockRate = videoCodec?.clockRate || 90000;
      const videoMime = videoCodec?.mimeType?.split('/')?.[1]?.toUpperCase() || 'VP8';

      sdpLines.push(`m=video ${videoPort} RTP/AVP ${videoPayloadType}`);
      if (videoRtcpPort) {
        sdpLines.push(`a=rtcp:${videoRtcpPort}`);
      }
      sdpLines.push(`a=rtpmap:${videoPayloadType} ${videoMime}/${videoClockRate}`);

      // Add profile-level-id for H264
      if (videoMime === 'H264') {
        const profileLevelId = videoCodec?.parameters?.['profile-level-id'] || '4d0032';
        const packetizationMode = videoCodec?.parameters?.['packetization-mode'] || 1;
        sdpLines.push(`a=fmtp:${videoPayloadType} profile-level-id=${profileLevelId};packetization-mode=${packetizationMode}`);
      }
      sdpLines.push('a=recvonly');
    }

    const sdpContent = sdpLines.join('\r\n') + '\r\n';

    // Write SDP to a temp file
    const sdpPath = path.join(recordingsDir, `${sessionId}.sdp`);
    fs.writeFileSync(sdpPath, sdpContent);

    console.log(`[Recorder] SDP written to ${sdpPath}`);
    console.log(`[Recorder] SDP content:\n${sdpContent}`);

    // Build FFmpeg command
    const ffmpegArgs = [
      '-loglevel', 'warning',
      '-protocol_whitelist', 'file,udp,rtp',
      '-fflags', '+genpts',
      '-i', sdpPath,
    ];

    // Output encoding: transcode to ensure container compatibility
    if (audioPort && videoPort) {
      ffmpegArgs.push(
        '-map', '0:a:0',
        '-map', '0:v:0',
        '-c:a', 'aac',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
      );
    } else if (audioPort) {
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
      // Clean up SDP file
      try { fs.unlinkSync(sdpPath); } catch {}
    });

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
   * @returns {{ filePath: string } | null}
   */
  stopRecording(sessionId) {
    const recording = this.recordings.get(sessionId);
    if (!recording) {
      console.warn(`[Recorder] No active recording for session ${sessionId}`);
      return null;
    }

    const { process: ffmpegProcess, transports, consumers, filePath, sdpPath } = recording;

    // Close all consumers first
    for (const consumer of consumers) {
      try { consumer.close(); } catch {}
    }

    // Close all transports
    for (const transport of transports) {
      try { transport.close(); } catch {}
    }

    // Send 'q' to FFmpeg stdin for graceful exit (writes trailer)
    try {
      if (ffmpegProcess && !ffmpegProcess.killed) {
        ffmpegProcess.stdin.write('q');
        // Give FFmpeg a moment to flush, then force kill if needed
        setTimeout(() => {
          if (!ffmpegProcess.killed) {
            ffmpegProcess.kill('SIGTERM');
          }
        }, 3000);
      }
    } catch (err) {
      console.error('[Recorder] Error stopping FFmpeg:', err);
      try { ffmpegProcess.kill('SIGTERM'); } catch {}
    }

    this.recordings.delete(sessionId);

    console.log(`[Recorder] Recording stopped for session ${sessionId}: ${filePath}`);
    return { filePath };
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
