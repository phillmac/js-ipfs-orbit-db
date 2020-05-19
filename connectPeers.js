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
        for (const prov of await peerMan.findPeers(db).search) {
          const provId = prov.id.toB58String()
          if (provId !== ipfsID && !(peers.some((p) => provId === p.peer))) {
            for (const a of prov.multiaddrs.toArray().map(a => `${a.toString()}/ipfs/${provId}`)) {
              try {
                console.info(`Connecting ${a}`)
                await ipfs.swarm.connect(a)
                console.info(`Connected ${provId}`)
                break
              } catch (err) { }
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
