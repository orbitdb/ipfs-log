'use strict'

const Log = require('../src/log')
const Entry = require('../src/entry')
const IPFS = require('ipfs-daemon')

// Metrics
let totalQueries = 0
let seconds = 0
let queriesPerSecond = 0
let lastTenSeconds = 0
let log1, log2

const queryLoop = () => {
  const add1 = log1.add(totalQueries)
  const add2 = log2.add(totalQueries)

  Promise.all([add1])
    .then(() => log1.join(log2))
    .then(() => {
      totalQueries++
      lastTenSeconds++
      queriesPerSecond++
      process.nextTick(queryLoop)
    })
    .catch((e) => {
      console.log(e)
      process.exit(0)
    })
}

let run = (() => {
  console.log('Starting benchmark...')

  const ipfs = new IPFS({ Flags: [] })

  ipfs.on('error', (err) => {
    console.error(err)
    process.exit(1)
  })

  ipfs.on('ready', () => {
    // Output metrics at 1 second interval
    setInterval(() => {
      seconds++
      if (seconds % 10 === 0) {
        console.log(`--> Average of ${lastTenSeconds / 10} q/s in the last 10 seconds`)
        if (lastTenSeconds === 0) {
          throw new Error('Problems!')
        }
        lastTenSeconds = 0
      }
      console.log(`${queriesPerSecond} queries per second, ${totalQueries} queries in ${seconds} seconds`)
      queriesPerSecond = 0
    }, 1000)

    log1 = new Log(ipfs, 'A')
    log2 = new Log(ipfs, 'B')
    queryLoop()
  })
})()

module.exports = run
