const mediasoup = require('mediasoup');
const os = require('os');

// Auto-detect a non-loopback IPv4 address for LAN connectivity
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const mediaCodecs = [
  { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
  { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: {} },
  { kind: 'video', mimeType: 'video/H264', clockRate: 90000, parameters: { 'packetization-mode': 1, 'profile-level-id': '4d0032' } }
];

class SfuManager {
  constructor() {
    this.worker = null;
    this.rooms = new Map(); // sessionId -> { router, peers: Map<socketId, peer> }
  }

  async createWorker() {
    this.worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: parseInt(process.env.RTC_MIN_PORT) || 10000,
      rtcMaxPort: parseInt(process.env.RTC_MAX_PORT) || 10100,
    });

    this.worker.on('died', () => {
      console.error('mediasoup worker died, exiting in 2 seconds... [pid:%d]', this.worker.pid);
      setTimeout(() => process.exit(1), 2000);
    });

    return this.worker;
  }

  // Alias for index.js compatibility if it calls startWorker instead of createWorker
  async startWorker() {
    return this.createWorker();
  }

  async getOrCreateRoom(sessionId) {
    let room = this.rooms.get(sessionId);
    if (!room) {
      if (!this.worker) {
        throw new Error('Mediasoup worker not created');
      }
      const router = await this.worker.createRouter({ mediaCodecs });
      room = {
        router,
        peers: new Map() // socketId -> { transports, producers, consumers }
      };
      this.rooms.set(sessionId, room);
    }
    return room;
  }

  async createWebRtcTransport(sessionId, socketId) {
    const room = await this.getOrCreateRoom(sessionId);

    let peer = room.peers.get(socketId);
    if (!peer) {
      peer = {
        transports: new Map(),
        producers: new Map(),
        consumers: new Map()
      };
      room.peers.set(socketId, peer);
    }

    // Determine the announced IP: explicit env var > auto-detected LAN IP
    const announcedIp = process.env.ANNOUNCED_IP || getLocalIp();
    console.log(`[SFU] WebRTC transport announced IP: ${announcedIp}`);

    const listenIps = [
      {
        ip: '0.0.0.0',
        announcedIp,
      }
    ];

    const transport = await room.router.createWebRtcTransport({
      listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate: 1000000
    });

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        transport.close();
      }
    });

    transport.on('routerclose', () => {
      transport.close();
    });

    peer.transports.set(transport.id, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters
    };
  }

  async connectTransport(sessionId, socketId, transportId, dtlsParameters) {
    const room = this.rooms.get(sessionId);
    if (!room) throw new Error('Room not found');
    const peer = room.peers.get(socketId);
    if (!peer) throw new Error('Peer not found');
    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    await transport.connect({ dtlsParameters });
  }

  async produce(sessionId, socketId, transportId, kind, rtpParameters, appData) {
    const room = this.rooms.get(sessionId);
    if (!room) throw new Error('Room not found');
    const peer = room.peers.get(socketId);
    if (!peer) throw new Error('Peer not found');
    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error('Transport not found');

    // Mark as producing transport to differentiate from receiving transport later
    transport.appData.producing = true;

    const producer = await transport.produce({ kind, rtpParameters, appData });
    console.log(`[SFU] produce SUCCESS: socket ${socketId} is producing ${kind} (producerId: ${producer.id})`);

    producer.on('transportclose', () => {
      producer.close();
    });

    peer.producers.set(producer.id, producer);

    return producer.id;
  }

  async consume(sessionId, consumerSocketId, producerSocketId, producerId, rtpCapabilities) {
    const room = this.rooms.get(sessionId);
    if (!room) throw new Error('Room not found');

    const router = room.router;
    if (!router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('Cannot consume');
    }

    const consumerPeer = room.peers.get(consumerSocketId);
    if (!consumerPeer) throw new Error('Consumer peer not found');

    // Find the consumer's receiving transport. 
    // Usually the one that hasn't produced anything, or just pick the latest one if multiple.
    const transports = Array.from(consumerPeer.transports.values());
    const transport = transports.find(t => !t.appData.producing) || transports[transports.length - 1];

    if (!transport) throw new Error('Receiving transport not found');

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: true
    });
    console.log(`[SFU] consume SUCCESS: socket ${consumerSocketId} is consuming producer ${producerId} from socket ${producerSocketId} (consumerId: ${consumer.id})`);

    consumer.on('transportclose', () => {
      consumer.close();
    });

    consumer.on('producerclose', () => {
      consumer.close();
      consumerPeer.consumers.delete(consumer.id);
    });

    consumerPeer.consumers.set(consumer.id, consumer);

    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters
    };
  }

  closeProducer(sessionId, socketId, producerId) {
    const room = this.rooms.get(sessionId);
    if (!room) return;
    const peer = room.peers.get(socketId);
    if (!peer) return;

    const producer = peer.producers.get(producerId);
    if (producer) {
      producer.close();
      peer.producers.delete(producerId);
    }
  }

  closePeer(sessionId, socketId) {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    const peer = room.peers.get(socketId);
    if (!peer) return;

    // Close all transports
    for (const transport of peer.transports.values()) {
      transport.close();
    }

    room.peers.delete(socketId);

    // If room has 0 peers, close router and delete room
    if (room.peers.size === 0) {
      room.router.close();
      this.rooms.delete(sessionId);
    }
  }

  getRoomProducers(sessionId, excludeSocketId) {
    const room = this.rooms.get(sessionId);
    if (!room) return [];

    const producers = [];
    for (const [peerSocketId, peer] of room.peers.entries()) {
      if (peerSocketId === excludeSocketId) continue;
      for (const [producerId, producer] of peer.producers.entries()) {
        producers.push({
          socketId: peerSocketId,
          producerId,
          kind: producer.kind,
          appData: producer.appData
        });
      }
    }
    return producers;
  }
}

const sfuManager = new SfuManager();

const createSfuManager = async () => {
  await sfuManager.createWorker();
  return sfuManager;
};

// Exporting to support CommonJS while satisfying the user's default/named exports request syntax
module.exports = sfuManager;
module.exports.default = sfuManager;
module.exports.createSfuManager = createSfuManager;
