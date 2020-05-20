const Ipfs = require('ipfs')

async function run () {
  const ipfs = await Ipfs.create({
    preload: { enabled: true },
    repo: './js-ipfs',
    start: false,
    EXPERIMENTAL: { pubsub: true },
    config: {
      Addresses: {
        Swarm: ['/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star'
        ]
      }
    },
    libp2p: { config: { dht: { enabled: true } } },
    relay: {
      enabled: true, // enable relay dialer/listener (STOP)
      hop: {
        enabled: false // make this node a relay (HOP)
      }
    }
  })

  //   await ipfs.config.profiles.apply('server')
  await ipfs.start()
  await ipfs.ready

  const example = require('./example.js')(ipfs, () => ipfs.stop())
  example()
}
run()
