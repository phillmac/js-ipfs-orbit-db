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
      let prevReplication = {}
      const entries = {}
      setInterval(async () => {
        try {
          const db = dbMan.get('keyvalue_test')
          if (db) {
            const replicationStatus = db.replicationStatus

            if (!(hasChanged(prevReplication, replicationStatus))) {
              // return
            }

            prevReplication = replicationStatus

            const { progress, max, queued } = replicationStatus

            if (progress > 0) {
              const buffer = db._replicator._buffer[0] || {}
              const headsIndex = buffer._headsIndex
              const nexts = Object.keys(headsIndex)

              const fetchNext = async (nList) => {
                for (const h of nList) {
                  if (h in entries) continue
                  entries[h] = (await ipfs.dag.get(h)).value
                  const vnext = entries[h].next.map(cid => cid.toString())
                  const vrefs = (entries[h].refs || []).map(cid => cid.toString())
                  console.dir({ h, value: entries[h], vnext, vrefs, replicationStatus: db.replicationStatus, entries:Object.keys(entries).length })
                  console.dir(db.replicationStatus)
                  await fetchNext(vnext)
                }
              }
              await fetchNext(nexts)
            }
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
