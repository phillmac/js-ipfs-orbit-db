let lockout = false
const connectPeers = function (options) {
  const { ipfs, peerMan, ipfsID } = options
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
        for await (const prov of ipfs.dht.findProvs(db.address.root)) {
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
              provAddrs = []
              // provAddrs.concat(prov.multiaddrs.toArray().map(a => `${a.toString()}/ipfs/${provId}`))
              provAddrs.push(`/ipfs/${provId}`)
              provAddrs.push(`/p2p-circuit/ipfs/${provId}`)
              for (const a of provAddrs) {
                try {
                  console.info(`Connecting ${a}`)
                  await ipfs.swarm.connect(a)
                  console.info(`Connected ${provId}`)
                  break
                } catch (err) { }
              }
            } else {
              console.info(`Skipping ${provId}: no addrs available`)
            }
          }
        }
      } catch (err) {
        console.error('Error while connecting peers', err)
      }
    }
    lockout = false
    console.info('Done')
  }
}
module.exports = connectPeers
