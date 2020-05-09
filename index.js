const Ipfs = require('ipfs')
const OrbitDB = require('orbit-db')
const { PeerManager, DBManager } = require('orbit-db-managers')
const PeerStore = require('libp2p/src/peer-store')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const multiaddr = require('multiaddr')

async function run () {
  const ipfs = await Ipfs.create({
    preload: { enabled: true },
    repo: './ipfs',
    start: false,
    EXPERIMENTAL: { pubsub: true },
    libp2p: { config: { dht: { enabled: true } } },
    relay: {
      enabled: true, // enable relay dialer/listener (STOP)
      hop: {
        enabled: true // make this node a relay (HOP)
      }
    }
  })
  await ipfs.config.profiles.apply('server')
  await ipfs.start()
  await ipfs.ready

  const orbitdb = await OrbitDB.createInstance(ipfs)
  const peerMan = new PeerManager(ipfs, orbitdb, {
    PeerId,
    PeerInfo,
    multiaddr,
    PeerStore
  })
  const dbMan = new DBManager(orbitdb, peerMan, { logger: console })

  const db = await dbMan.openCreate(
    '/orbitdb/zdpuAuSAkDDRm9KTciShAcph2epSZsNmfPeLQmxw6b5mdLmq5/keyvalue_test',
    { awaitLoad: false }
  )

  const shutdown = async () => {
    await orbitdb.stop()
    await ipfs.stop()
    process.exit()
  }

  process.on('SIGINT', shutdown)
  process.on('beforeExit', shutdown)


  const peers = []
  for await (const p of ipfs.dht.findPeers(db.address.root)) {
    peers.push(p)
  }

  console.dir(peers)


}
run()
