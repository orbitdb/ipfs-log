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
let immediate

let waveCount = 0
let waveLength = 10 // seconds
let waveDepth = parseInt(process.argv[2], 10) || 10000

let addEntries = async () => {
  for (let i=0; i<waveDepth; i++) {
    await log.append(`Hello World: ${i}`)
  }

  // choose random entry
  entry = log.values[Math.floor(Math.random() * log.values.length)]

  console.log(`=== Running wave #${waveCount} for ${waveLength} seconds with ${log.values.length} entries ===`)
}

const queryLoop = async () => {
  log.get(entry.hash)
  totalQueries++
  lastTenSeconds++
  queriesPerSecond++
  immediate = setImmediate(queryLoop)
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

    await addEntries()

    const nextWave = async () => {
      //reset counters
      totalQueries = 0
      seconds = 0
      queriesPerSecond = 0
      lastTenSeconds = 0

      waveCount++
      await addEntries()

      interval = setInterval(outputMetrics, 1000)
      immediate = setImmediate(queryLoop)
    }

    const outputMetrics = () => {
      seconds++

      console.log(`${queriesPerSecond} queries per second, ${totalQueries} queries in ${seconds} seconds (Entry count: ${log.values.length})`)
      queriesPerSecond = 0

      if (seconds % waveLength === 0) {
        console.log(`--> Average of ${lastTenSeconds / 10} q/s in this wave`)
        if (lastTenSeconds === 0) throw new Error('Problems!')
        lastTenSeconds = 0
        clearImmediate(immediate)
        clearInterval(interval)
        nextWave()
      }
    }

    // Output metrics at 1 second interval
    let interval = setInterval(outputMetrics, 1000)
    immediate = setImmediate(queryLoop)
  })
})()

module.exports = run
