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
    const orbitDB = await OrbitDB.createInstance(ipfs, { directory: 'go-ipfs-orbitdb' })
    const peerMan = new PeerManager({
      ipfs,
      orbitDB,
      PeerId,
      PeerInfo,
      multiaddr,
      PeerStore,
      EventEmitter,
      options: { logger: console }

    })

    const dbMan = new DBManager({ orbitDB, peerMan, options: { logger: console } })

    const shutdown = async () => {
      console.info('Stopping...')
      try {
        await orbitDB.stop()
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

    orbitDB.events.once('ready', (...args) => {
      console.dir(args)
      let prevReplication = {}
      setInterval(() => {
        try {
          const db = dbMan.get('keyvalue_test')
          if (db) {
            const replicationStatus = db.replicationStatus

            if (!(hasChanged(prevReplication, replicationStatus))) {
              return
            }

            prevReplication = replicationStatus

            const { progress, max, queued } = replicationStatus
            if (progress > 0) console.info({ replicationStatus })
            if (progress === max && max > 0 && queued === 0) {
              console.info('Fully replicated')
              const dbKeys = Object.keys(db.all)
              console.info(`Keys in db: ${dbKeys.length}`)
              const sample = {}
              try {
                while (Object.keys(sample).length < 3) {
                  const rk = dbKeys[Math.floor(Math.random() * dbKeys.length)]
                  const sv = db.get(rk)
                  if (!(rk in sample)) sample[rk] = sv
                }
                console.info(`Sample: ${JSON.stringify(sample, null, 2)}`)
              } catch (err) {
                console.error(err)
              }

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

const hasChanged = (obj1, obj2) => {
  const obj1Keys = Object.keys(obj1)
  const obj2Keys = Object.keys(obj2)

  if (obj1Keys.length !== obj2Keys.length) {
    return true
  }

  for (const objKey of obj1Keys) {
    if (obj1[objKey] !== obj2[objKey]) {
      return true
    }
  }

  return false
}

module.exports = example
