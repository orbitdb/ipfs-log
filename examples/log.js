'use strict'

const IPFS = require('ipfs-daemon')
const Log = require('../src/log')

const ipfs = new IPFS()
const log = new Log(ipfs, 'A')

ipfs.on('error', (err) => console.error(err))

ipfs.on('ready', () => {
  // When IPFS is ready, add some log entries
  log.add('one')
    .then((entry1) => {
      console.log('Entry1:', entry1.hash, entry1.payload)
      return log.add({ two: 'hello' })
    })
    .then((entry2) => {
      console.log('Entry2:', entry2.hash, entry2.payload)
      console.log('Entry2.next:', entry2.next[0]) // == entry1.hash
      console.log('Done')
      process.exit(0)
    })
})
