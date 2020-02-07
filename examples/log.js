'use strict'

const IPFS = require('ipfs')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')
const Keystore = require('orbit-db-keystore')

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
  let identityA, identityB, identityC
  try {
    const keystore = new Keystore()
    identityA = await IdentityProvider.createIdentity({ id: 'identityA', keystore })
    identityB = await IdentityProvider.createIdentity({ id: 'identityB', keystore })
    identityC = await IdentityProvider.createIdentity({ id: 'identityC', keystore })
  } catch (e) {
    console.error(e)
  }

  let log1 = new Log(ipfs, identityA, { logId: 'A' })
  let log2 = new Log(ipfs, identityB, { logId: 'A' })
  let log3 = new Log(ipfs, identityC, { logId: 'A' })

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
