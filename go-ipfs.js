const Ctl = require('ipfsd-ctl')

async function run () {
  const ipfsd = await Ctl.createController({
    ipfsHttpModule: require('ipfs-http-client'),
    ipfsBin: require('go-ipfs-dep').path(),
    args: ['--enable-pubsub-experiment']
  })
  const ipfs = ipfsd.api
  await ipfs.config.profiles.apply('server')
  await ipfs.ready

  const example = require('./example.js')(ipfs, ipfsd.stop)
  example()
}
run()
