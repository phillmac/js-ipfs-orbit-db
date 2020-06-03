const IpfsHttpClient = require('ipfs-http-client')

async function run () {
  const ipfs = await IpfsHttpClient('http://ipfs:5001')

  const example = require('./example.js')(ipfs, () => {})
  example()
}
run()
