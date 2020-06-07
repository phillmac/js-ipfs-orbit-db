const getManagers = require('./managers.js')

function example (ipfs, stopIpfs) {
  return async () => {
    const ipfsID = (await ipfs.id()).id
    console.info('ipfs id:', ipfsID)
    const { peerMan, dbMan, orbitDB } = await getManagers(ipfs)
    const connectPeers = require('./connectPeers.js')({ ipfs, peerMan, ipfsID })

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

    let success = false
    while (!success) {
      try {
        const db = await dbMan.openCreate(
          '/orbitdb/zdpuAuSAkDDRm9KTciShAcph2epSZsNmfPeLQmxw6b5mdLmq5/keyvalue_test',
          { awaitOpen: false, fetchEntryTimeout: 30000, relayEvents: ['ready', 'replicate.progress', 'replicated'] }
        )
        success = true
        setInterval(async () => {
          const peers = await ipfs.pubsub.peers(db.id)
          if (peers.length < 1) {
            connectPeers(db)
          }
        }, 30 * 1000)
        // connectPeers(db)
      } catch (err) {
        console.error(err)
      }
    }

    orbitDB.events.once('open', (...args) => {
      const eventsQueue = []
      try {
        const db = dbMan.get('keyvalue_test')
        console.info('Caught open event')
        // for (const eventType in ['load.added', 'load.progress', 'load.end']) {
        //   db._replicator.on(eventType, (...args) => eventsQueue.push({ origin: 'replicator', type: eventType, db: db.id, ...args }))
        // }

        for (const eventType in ['ready', 'load', 'load.progress.start', 'load.progress', 'replicate', 'replicated', 'log.op', 'replicate.progress', 'peer']) {
          db.events.on(eventType, (...args) => eventsQueue.push({ origin: 'store', type: eventType, db: db.id, ...args }))
        }
      } catch (err) {
        console.error(err)
      }
      setInterval(() => {
        const event = eventsQueue.pop()
        if (event) console.dir(event)
      })
    })

    orbitDB.events.once('ready', (...args) => {
      let prevReplication = {}
      setInterval(() => {
        try {
          const db = dbMan.get('keyvalue_test')
          if (db) {
            const replicationStatus = db.replicationStatus

            if (!(hasChanged(prevReplication, replicationStatus))) {
              console.info('No change', prevReplication)
              // return
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
