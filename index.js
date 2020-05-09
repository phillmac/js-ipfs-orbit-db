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
  console.info('ipfs id:', (await ipfs.id()).id)

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

  console.info(dbMan.dbInfo(db))

  db.events.on('replicate.progress', (address, hash, entry, progress, have) => console.info({ address, hash, entry, progress, have }))

  const shutdown = async () => {
    console.info("Stopping...")
    await orbitdb.stop()
    await ipfs.stop()
    process.exit()
    console.info("Done")
  }

  process.on('SIGINT', shutdown)
  process.on('beforeExit', shutdown)

  console.info('Finding peers')
  const peers = []
  for await (const p of ipfs.dht.findProvs(db.address.root)) {
    peers.push(p)
    console.info(p.id, (await ipfs.id().id), p.id !== (await ipfs.id().id) )
    // if(p.id !== (await ipfs.id().id)) {
    //   p.addrs.forEach(a => console.info(p.id, a.toString()))
    // }
  }
}
run()
