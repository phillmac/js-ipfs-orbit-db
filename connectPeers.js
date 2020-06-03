const { default: PQueue } = require('p-queue')
const pQueue = new PQueue({ concurrency: 1 })

let lockout = false
const connectPeers = function (options) {
  const { ipfs, peerMan, ipfsID } = options

  const doConnect = async (provAddrs, provId) => {
    for (const a of provAddrs) {
      try {
        console.info(`Connecting ${a}`)
        await ipfs.swarm.connect(a)
        console.info(`Connected ${provId}`)
        break
      } catch (err) { }
    }
  }

  const connectPeer = (provId) => {
    return doConnect([
      `/ipfs/${provId}`,
      `/p2p-circuit/ipfs/${provId}`
    ], provId)
  }

  return async (db) => {
    if (lockout) {
      console.warn('connectPeers lockout')
      return
    }
    lockout = true
    console.info('Connecting peers')
    let peers
    try {
      peers = await ipfs.swarm.peers()
    } catch (err) {
      console.error('Error fetching swarm peers', err)
    }
    if (peers) {
      try {
        for await (const prov of ipfs.dht.findProvs(db.address.root, {timeout: 15 * 1000})) {
        // for (const prov of await peerMan.findPeers(db).search) {
          console.dir(prov)
          const provId = typeof prov.id === 'string' ? prov.id : prov.id.toB58String()
          if (provId !== ipfsID && !(peers.some((p) => provId === p.peer))) {
            let provAddrs = []
            if (prov.multiaddrs && prov.multiaddrs.toArray()) {
              provAddrs = prov.multiaddrs.toArray()
            } else if (prov.addrs) {
              provAddrs = prov.addrs
            }
            if (provAddrs.length < 0) {
              // provAddrs.concat(prov.multiaddrs.toArray().map(a => `${a.toString()}/ipfs/${provId}`))

              pQueue.add(connectPeer(provId))
            } else {
              try {
                console.info(`Resolving peer ${provId}`)
                const foundPeer = await ipfs.dht.findPeer(provId, {timeout: 15 * 1000})
                if (foundPeer.addrs.length < 0) {
                  console.info(`Skipping ${provId}: no addrs available`)
                  continue
                }
                console.dir(foundPeer)
              } catch (err) {
                //console.error(err)
              }
            }
          }
        }
      } catch (err) {
        console.error('Error while connecting peers', err)
      }
    } else {
        console.debug('No peers available')
    }
    lockout = false
    console.info('Done')
  }
}
module.exports = connectPeers
