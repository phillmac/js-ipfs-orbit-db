const Ipfs = require("ipfs");
const OrbitDB = require("orbit-db");
const { PeerManager, DBManager } = require("orbit-db-managers");
const PeerStore = require("libp2p/src/peer-store");
const PeerId = require("peer-id");
const PeerInfo = require("peer-info");
const multiaddr = require("multiaddr");

async function init() {
  const ipfs = await Ipfs.create({
    preload: { enabled: true },
    repo: "./ipfs3",
    start: false,
    EXPERIMENTAL: { pubsub: true },
    libp2p: { config: { dht: { enabled: true } } },
    relay: {
      enabled: true, // enable relay dialer/listener (STOP)
      hop: {
        enabled: true // make this node a relay (HOP)
      }
    }
  });
  await ipfs.config.profiles.apply("server");
  await ipfs.start();
  await ipfs.ready;

  const orbitdb = await OrbitDB.createInstance(ipfs);
  const peerMan = new PeerManager(ipfs, orbitdb, {
    PeerId,
    PeerInfo,
    multiaddr,
    PeerStore
  });
  const dbMan = new DBManager(orbitdb, peerMan, { logger: console });

  const peers = await ipfs.swarm.peers();
  console.dir({ peers });

  for await (const p of ipfs.dht.findProvs(
    "zdpuAuSAkDDRm9KTciShAcph2epSZsNmfPeLQmxw6b5mdLmq5"
  )) {
    console.dir({ p });
  }
  const db = await dbMan.openCreate(
    "/orbitdb/zdpuAuSAkDDRm9KTciShAcph2epSZsNmfPeLQmxw6b5mdLmq5/keyvalue_test",
    { awaitLoad: false }
  );
  console.dir(dbMan.dbInfo(db));
}
init();
