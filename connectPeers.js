const connectPeers = function (options) {
  const { ipfs, peerMan, ipfsID } = options
  return async (db) => {
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
          console.dir(prov)
          const provId = prov.id.toB58String()
          if (provId !== ipfsID && !(peers.some((p) => provId === p.peer))) {
            for (const a of prov.multiaddrs.toArray().map(a => `${a.toString()}/ipfs/${provId}`)) {
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
    }
    console.info('Done')
  }
}
module.exports = connectPeers
