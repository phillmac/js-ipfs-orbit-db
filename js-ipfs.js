const Ipfs = require('ipfs')
const OrbitDB = require('orbit-db')
const { PeerManager, DBManager } = require('orbit-db-managers')
const PeerStore = require('libp2p/src/peer-store')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const multiaddr = require('multiaddr')
const { EventEmitter } = require('events')

async function run () {
  const ipfs = await Ipfs.create({
    preload: { enabled: true },
    repo: './js-ipfs',
    start: false,
    EXPERIMENTAL: { pubsub: true },
    libp2p: { config: { dht: { enabled: true } } },
    relay: {
      enabled: true, // enable relay dialer/listener (STOP)
      hop: {
        enabled: false // make this node a relay (HOP)
      }
    }
  })
  await ipfs.config.profiles.apply('server')
  await ipfs.start()
  await ipfs.ready
  const ipfsID = (await ipfs.id()).id
  console.info('ipfs id:', ipfsID)

  const orbitdb = await OrbitDB.createInstance(ipfs, { directory: 'js-ipfs-orbitdb' })
  const peerMan = new PeerManager(ipfs, orbitdb, {
    PeerId,
    PeerInfo,
    multiaddr,
    PeerStore,
    EventEmitter,
    logger: console
  })
  const dbMan = new DBManager(orbitdb, peerMan, { logger: console })

  const shutdown = async () => {
    console.info('Stopping...')
    await orbitdb.stop()
    await ipfs.stop()
    console.info('Done')
    process.exit()
  }

  process.on('SIGINT', shutdown)
  process.on('beforeExit', shutdown)

  const db = await dbMan.openCreate(
    '/orbitdb/zdpuAuSAkDDRm9KTciShAcph2epSZsNmfPeLQmxw6b5mdLmq5/keyvalue_test',
    { awaitLoad: false }
  )

  // console.info(dbMan.dbInfo(db))

  //   setInterval(() => console.dir({
  //     open: dbMan.pendingOpens(),
  //     ready: dbMan.pendingReady(),
  //     load: dbMan.pendingLoad()
  //   }), 5 * 1000)
  // db.events.on('replicate.progress', (address, hash, entry, progress, have) => console.info('replicate.progress:', { address, hash, entry, progress, have }))
  // db.events.on('replicated', () => shutdown())

  const connectPeers = require('./connectPeers.js')({ ipfs, peerMan, ipfsID })

  setInterval(() => connectPeers(db), 300 * 1000)
  connectPeers(db, ipfs, ipfsID)
}
run()
