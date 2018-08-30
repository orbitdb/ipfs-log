'use strict'

const IPFS = require('ipfs')
const Log = require('../src/log')
const { AccessController, IdentityProvider, Keystore } = Log

const dataPath = './ipfs/examples/log'

const ipfs = new IPFS({
  repo: dataPath + '/ipfs',
  start: false,
  EXPERIMENTAL: {
    pubsub: true
  }
})

ipfs.on('error', (err) => console.error(err))
ipfs.on('ready', async () => {
  const keystore = Keystore.create(dataPath + '/keystore')
  const identitySignerFn = (key, data) => keystore.sign(key, data)
  const access = new AccessController()

  let identityA, identityB, identityC

  try {
    identityA = await IdentityProvider.createIdentity(keystore, 'identityA', identitySignerFn)
    identityB = await IdentityProvider.createIdentity(keystore, 'identityB', identitySignerFn)
    identityC = await IdentityProvider.createIdentity(keystore, 'identityC', identitySignerFn)
  } catch (e) {
    console.error(e)
  }

  // Create access controllers: allow write for key1 and key2
  let log1 = new Log(ipfs, access, identityA, 'A')
  let log2 = new Log(ipfs, access, identityB, 'A')
  let log3 = new Log(ipfs, access, identityC, 'A')

  try {
    await log1.append('one')
    await log1.append('two')
    await log2.append('three')
    // Join the logs
    await log3.join(log1)
    await log3.join(log2)
    // Add one more
    await log3.append('four')
    console.log(log3.values)
  } catch (e) {
    console.error(e)
    process.exit(1)
  }
  console.log(log3.toString())
  // four
  // └─two
  //   └─one
  // └─three
  process.exit(0)
})
