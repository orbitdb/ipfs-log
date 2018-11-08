module.exports = {
  timeout: 30000,
  testKeysPath: './test/fixtures/keys',
  defaultIpfsConfig: {
    preload: {
      enabled: false
    },
    repo: './ipfs/ipfs-log/tests/daemon',
    start: true,
    EXPERIMENTAL: {
      pubsub: true
    },
    config: {
      Addresses: {
        API: '/ip4/127.0.0.1/tcp/0',
        Swarm: ['/ip4/0.0.0.0/tcp/0'],
        Gateway: '/ip4/0.0.0.0/tcp/0'
      },
      Bootstrap: [],
      Discovery: {
        MDNS: {
          Enabled: true,
          Interval: 0
        },
        webRTCStar: {
          Enabled: false
        }
      }
    }
  },
  daemon1: {
    repo: './ipfs/ipfs-log/tests/daemon1',
    start: true,
    EXPERIMENTAL: {
      pubsub: true
    },
    preload: {
      enabled: false
    },
    config: {
      Addresses: {
        API: '/ip4/127.0.0.1/tcp/0',
        Swarm: [
          '/ip4/0.0.0.0/tcp/0',
          '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
        ],
        Gateway: '/ip4/0.0.0.0/tcp/0'
      },
      Bootstrap: [],
      Discovery: {
        MDNS: {
          Enabled: true,
          Interval: 0
        },
        webRTCStar: {
          Enabled: false
        }
      }
    }
  },
  daemon2: {
    repo: './ipfs/ipfs-log/tests/daemon2',
    start: true,
    EXPERIMENTAL: {
      pubsub: true
    },
    preload: {
      enabled: false
    },
    config: {
      Addresses: {
        API: '/ip4/127.0.0.1/tcp/0',
        Swarm: [
          '/ip4/0.0.0.0/tcp/0',
          '/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
        ],
        Gateway: '/ip4/0.0.0.0/tcp/0'
      },
      Bootstrap: [],
      Discovery: {
        MDNS: {
          Enabled: true,
          Interval: 0
        },
        webRTCStar: {
          Enabled: false
        }
      }
    }
  }
}
