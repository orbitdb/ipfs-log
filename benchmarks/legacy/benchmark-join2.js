'use strict'

const IPFS = require('ipfs')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')
const Keystore = require('orbit-db-keystore')

// State
let ipfs
let log1, log2

// Metrics
// const totalQueries = 0
// const queryLoop = async () => {
//   try {
//     await Promise.all([
//       log1.append('a' + totalQueries),
//       log2.append('b' + totalQueries)
//     ])
//
//     await log1.join(log2)
//     await log2.join(log1)
//     totalQueries++
//     setImmediate(queryLoop)
//   } catch (e) {
//     console.error(e)
//     process.exit(0)
//   }
// }

const run = (() => {
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
    // ipfs.dag.put = memstore.put.bind(memstore)
    // ipfs.dag.get = memstore.get.bind(memstore)
    const keystore = new Keystore('./benchmarks/ipfs-log-benchmarks/keys')
    const identity = await IdentityProvider.createIdentity({ id: 'userA', keystore })
    const identity2 = await IdentityProvider.createIdentity({ id: 'userB', keystore })

    log1 = new Log(ipfs, identity, { logId: 'A' })
    log2 = new Log(ipfs, identity2, { logId: 'A' })

    const amount = 10000
    console.log('log length:', amount)

    console.log('Writing log...')
    const st3 = new Date().getTime()
    for (let i = 0; i < amount; i++) {
      await log1.append('a' + i, 64)
    }
    const et3 = new Date().getTime()
    console.log('write took', (et3 - st3), 'ms')

    console.log('Joining logs...')
    const st = new Date().getTime()
    await log2.join(log1)
    const et = new Date().getTime()
    console.log('join took', (et - st), 'ms')

    console.log('Loading log...')
    const st2 = new Date().getTime()
    const l2 = await Log.fromEntryHash(ipfs, identity, log1.heads[0].hash, { logId: 'A' })
    const et2 = new Date().getTime()
    console.log('load took', (et2 - st2), 'ms')
    console.log('Entry size:', Buffer.from(JSON.stringify(l2.heads)).length, 'bytes')
    // console.log(log2.heads)
    console.log('log length:', log2.values.length)
    // console.log(log2.values.map(e => e.payload))
  })
})()

module.exports = run
