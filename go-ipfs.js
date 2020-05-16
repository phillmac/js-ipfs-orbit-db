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

  const orbitdb = await OrbitDB.createInstance(ipfs, { directory: 'go-ipfs-orbitdb' })
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
    await ipfsd.stop()
    console.info('Done')
    process.exit()
  }

  process.on('SIGINT', shutdown)
  process.on('beforeExit', shutdown)

  const connectPeers = require('./connectPeers.js')({ ipfs, peerMan, ipfsID })

  let opened = false
  while (!opened) {
    try {
      const db = await dbMan.openCreate(
        '/orbitdb/zdpuAuSAkDDRm9KTciShAcph2epSZsNmfPeLQmxw6b5mdLmq5/keyvalue_test',
        { awaitOpen: false, relayEvents: ['replicate.progress', 'replicated'] }
      )
      connectPeers(db)
      opened = true
    } catch (err) {
      console.error(err)
    }
  }

  //orbitdb.events.on('replicate.progress', (_addr, address, hash, entry, progress, have) => console.info('replicate.progress:', { address, hash, entry, progress, have }))
  orbitdb.events.on('replicated', () => {
    try {
        const db = dbMan.get('keyvalue_test')
        const replicationStatus = db.replicationStatus
        if(replicationStatus.progress === replicationStatus.max) {
            console.info('Fully replicated')
            shutdown()
        }
    }  catch (err) {
        console.log(err)
    }
  }

  setInterval(() => connectPeers(dbMan.get('keyvalue_test')), 300 * 1000)
}
run()
