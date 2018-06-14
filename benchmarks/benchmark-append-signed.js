'use strict'

const Log = require('../src/log')
const ACL = require('../src/acl')
const Keystore = require('orbit-db-keystore')
const IPFS = require('ipfs')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const MemStore = require('../test/utils/mem-store')

// State
let ipfs
let log

// Metrics
let totalQueries = 0
let seconds = 0
let queriesPerSecond = 0
let lastTenSeconds = 0

const queryLoop = async () => {
  await log.append(totalQueries.toString())
  totalQueries++
  lastTenSeconds++
  queriesPerSecond++
  setImmediate(queryLoop)
}

let run = (() => {
  console.log('Starting benchmark...')

  const repoConf = {
    storageBackends: {
      blocks: DatastoreLevel,
    },
  }

  ipfs = new IPFS({
    repo: new IPFSRepo('./ipfs-log-benchmarks/ipfs', repoConf),
    start: false,
    EXPERIMENTAL: {
      pubsub: false,
      sharding: false,
      dht: false,
    },
  })

  ipfs.on('error', (err) => {
    console.error(err)
  })

  ipfs.on('ready', () => {
    // Use memory store to test without disk IO
    // const memstore = new MemStore()
    // ipfs.object.put = memstore.put.bind(memstore)
    // ipfs.object.get = memstore.get.bind(memstore)

    const keystore = Keystore.create('./test-keys')
    const key = keystore.createKey('benchmark-append-signed')
    log = new Log(ipfs, 'A', null, null, null, new ACL(keystore, key, key.getPublic('hex')))

    // Output metrics at 1 second interval
    setInterval(() => {
      seconds++
      if (seconds % 10 === 0) {
        console.log(`--> Average of ${lastTenSeconds / 10} q/s in the last 10 seconds`)
        if (lastTenSeconds === 0) throw new Error('Problems!')
        lastTenSeconds = 0
      }
      console.log(`${queriesPerSecond} queries per second, ${totalQueries} queries in ${seconds} seconds (Entry count: ${log.values.length})`)
      queriesPerSecond = 0
    }, 1000)

    setImmediate(queryLoop)
  })
})()

module.exports = run
