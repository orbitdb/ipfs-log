'use strict'

const Log = require('../src/log')
const IPFS = require('ipfs')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')

// State
let ipfs
let log

// Metrics
let totalQueries = 0
let seconds = 0
let queriesPerSecond = 0
let lastTenSeconds = 0

let entry

const queryLoop = async () => {
  log.values
  totalQueries++
  lastTenSeconds++
  queriesPerSecond++
  setImmediate(queryLoop)
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
      pubsub: false,
      sharding: false,
      dht: false,
    },
  })

  ipfs.on('error', (err) => {
    console.error(err)
  })

  ipfs.on('ready', async () => {
    // Create a log
    log = new Log(ipfs, 'A')

    entry = await log.append('Hello World')

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
