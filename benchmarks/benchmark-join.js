'use strict'

const Log = require('../src/log')
const IPFS = require('ipfs')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const { AccessController, IdentityProvider, Keystore } = Log

// State
let ipfs
let log1, log2

// Metrics
let totalQueries = 0
let seconds = 0
let queriesPerSecond = 0
let lastTenSeconds = 0

const queryLoop = async () => {
  try {
    await Promise.all([
      log1.append('a' + totalQueries),
      log2.append('b' + totalQueries)
    ])

    await log1.join(log2)
    await log2.join(log1)
    totalQueries++
    lastTenSeconds++
    queriesPerSecond++
    setImmediate(queryLoop)
  } catch (e) {
    console.error(e)
    process.exit(0)
  }
}

let run = (() => {
  console.log('Starting benchmark...')

  const repoConf = {
    storageBackends: {
      blocks: DatastoreLevel
    }
  }

  ipfs = new IPFS({
    repo: new IPFSRepo('./ipfs-log-benchmarks/ipfs', repoConf),
    start: false,
    EXPERIMENTAL: {
      pubsub: true
    }
  })

  ipfs.on('error', (err) => {
    console.error(err)
    process.exit(1)
  })

  ipfs.on('ready', async () => {
    // Use memory store to test without disk IO
    // const memstore = new MemStore()
    // ipfs.object.put = memstore.put.bind(memstore)
    // ipfs.object.get = memstore.get.bind(memstore)

    const testKeysPath = './test/fixtures/keys'
    const keystore = Keystore.create(testKeysPath)
    const identitySignerFn = (key, data) => keystore.sign(key, data)
    const access = new AccessController()
    const identity = await IdentityProvider.createIdentity(keystore, 'userA', identitySignerFn)

    log1 = new Log(ipfs, access, identity, 'A')
    log2 = new Log(ipfs, access, identity, 'B')

    // Output metrics at 1 second interval
    setInterval(() => {
      seconds++
      if (seconds % 10 === 0) {
        console.log(`--> Average of ${lastTenSeconds / 10} q/s in the last 10 seconds`)
        if (lastTenSeconds === 0) throw new Error('Problems!')
        lastTenSeconds = 0
      }
      console.log(`${queriesPerSecond} queries per second, ${totalQueries} queries in ${seconds} seconds. log1: ${log1.length}, log2: ${log2.length}`)
      queriesPerSecond = 0
    }, 1000)

    queryLoop()
  })
})()

module.exports = run
