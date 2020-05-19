const OrbitDB = require('orbit-db')
const { PeerManager, DBManager } = require('orbit-db-managers')
const PeerStore = require('libp2p/src/peer-store')
const PeerId = require('peer-id')
const PeerInfo = require('peer-info')
const multiaddr = require('multiaddr')
const { EventEmitter } = require('events')

function example (ipfs, stopIpfs) {
  return async () => {
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
      try {
        await orbitdb.stop()
        await stopIpfs()
      } catch (err) {
        console.error(err)
      }
      console.info('Done')
      process.exit()
    }

    process.on('SIGINT', shutdown)
    process.on('beforeExit', shutdown)

    const connectPeers = require('./connectPeers.js')({ ipfs, peerMan, ipfsID })

    let success = false
    while (!success) {
      try {
        const db = await dbMan.openCreate(
          '/orbitdb/zdpuAuSAkDDRm9KTciShAcph2epSZsNmfPeLQmxw6b5mdLmq5/keyvalue_test',
          { awaitOpen: false, relayEvents: ['ready', 'replicate.progress', 'replicated'] }
        )
        success = true
        setInterval(() => connectPeers(db), 300 * 1000)
        connectPeers(db)
      } catch (err) {
        console.error(err)
      }
    }

    orbitdb.events.once('ready', (...args) => {
      console.dir(args)
      setInterval(() => {
        try {
          const db = dbMan.get('keyvalue_test')
          if (db) {
            const replicationStatus = db.replicationStatus
            const { progress, max, queued } = replicationStatus
            if (progress > 0) console.info({ replicationStatus })
            if (progress === max && max > 0 && queued === 0) {
              console.info('Fully replicated')
              const dbKeys = Object.keys(db.all)
              console.info(`Keys in db: ${dbKeys.length}`)
              const sample = {}
              while (Object.keys(sample).length < 3) {
                const rk = dbKeys[Math.floor(Math.random() * dbKeys.length)]
                const sk = db.get(rk)
                if (!(sample.contains(sk))) sample[sk] = rk
              }
              console.info(`Sample: ${JSON.stringify(sample, null, 2)}`)
              shutdown()
            }
          }
        } catch (err) {
          console.log(err)
        }
      }, 5 * 1000)
    })
  }
}

module.exports = example
