const Ctl = require('ipfsd-ctl')
const OrbitDB = require('orbit-db')
const { PeerManager, DBManager } = require('orbit-db-managers')
const PeerStore = require('libp2p/src/peer-store')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const multiaddr = require('multiaddr')
const { EventEmitter } = require('events')

async function run () {
  const ipfsd = await Ctl.createController({
    ipfsHttpModule: require('ipfs-http-client'),
    ipfsBin: require('go-ipfs-dep').path(),
    args: ['--enable-pubsub-experiment']
  })
  const ipfs = ipfsd.api
  await ipfs.config.profiles.apply('server')
  await ipfs.ready
  const ipfsID = (await ipfs.id()).id
  console.info('ipfs id:', ipfsID)

  const orbitdb = await OrbitDB.createInstance(ipfs)
  const peerMan = new PeerManager(ipfs, orbitdb, {
    PeerId,
    PeerInfo,
    multiaddr,
    PeerStore,
    EventEmitter
  })

  const connectPeers = async (hash) => {
    console.info('Connecting peers')
    let peers
    try {
      peers = await ipfs.swarm.peers()
    } catch (err) {
      console.error('Error fetching swarm peers', err)
    }
    if (peers) {
      try {
        for await (const prov of ipfs.dht.findProvs(hash)) {
          if (prov.id !== ipfsID && !(peers.some((p) => prov.id === p.peer))) {
            for (const a of prov.addrs.map(a => `${a.toString()}/ipfs/${prov.id}`)) {
              try {
                console.info(`Connecting ${a}`)
                await ipfs.swarm.connect(a)
                console.info(`Connected ${prov.id}`)
                break
              } catch (err) { console.log(err) }
            }
          }
        }
      } catch (err) {
        console.error('Error while connecting peers', err)
      }
    } else {
      console.error('No peers available')
    }
    console.info('Done')
  }

  const hash = 'zdpuAuSAkDDRm9KTciShAcph2epSZsNmfPeLQmxw6b5mdLmq5'
  setInterval(() => connectPeers(hash), 300 * 1000)
  await connectPeers(hash)
  const dbMan = new DBManager(orbitdb, peerMan, { logger: console })

  let db
  while (!db) {
    try {
      db = await dbMan.openCreate(
        '/orbitdb/zdpuAuSAkDDRm9KTciShAcph2epSZsNmfPeLQmxw6b5mdLmq5/keyvalue_test',
        { awaitLoad: false }
      )
    } catch (err) {
      console.error(err)
    }
  }

  // console.info(dbMan.dbInfo(db))

  db.events.on('replicate.progress', (address, hash, entry, progress, have) => console.info('replicate.progress:', { address, hash, entry, progress, have }))

  const shutdown = async () => {
    console.info('Stopping...')
    await orbitdb.stop()
    await ipfsd.stop()
    console.info('Done')
    process.exit()
  }

  process.on('SIGINT', shutdown)
  process.on('beforeExit', shutdown)
}
run()
