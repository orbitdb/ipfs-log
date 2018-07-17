'use strict'

const IPFS = require('ipfs')
const Log = require('../src/log')
const Keystore = require('orbit-db-keystore')

const dataPath = './ipfs/examples/log'

const ipfs = new IPFS({
  repo: dataPath + '/ipfs',
  start: false,
  EXPERIMENTAL: {
    pubsub: true
  },
})

ipfs.on('error', (err) => console.error(err))
ipfs.on('ready', async () => {
  const keystore = Keystore.create(dataPath + '/keystore')

  let key1, key2, key3
  try {
    key1 = keystore.getKey('A') || keystore.createKey('A')
    key2 = keystore.getKey('C') || keystore.createKey('C')
  } catch (e) {
    console.error(e)
  }

  const getEntryValidator = key => ({
    publicKey: key.getPublic('hex'),
    checkPermissionsAndSign: (entry, data) => keystore.sign(key, data),
    checkPermissionsAndVerifySignature: async (entry, data) =>  {
      const pubKey = await keystore.importPublicKey(entry.key)
      return keystore.verify(entry.sig, pubKey, data)
    }
  })

  // Create access controllers: allow write for key1 and key2
  let log1 = new Log(ipfs, 'A', null, null, null, getEntryValidator(key1))
  let log2 = new Log(ipfs, 'A', null, null, null, getEntryValidator(key1))
  let log3 = new Log(ipfs, 'A', null, null, null, getEntryValidator(key2))

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
