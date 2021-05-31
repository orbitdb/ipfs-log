'use strict'
const Ipfs = require('ipfs')
const Log = require('../src/log')
const { createLog, height, appendEntries } = require('./utils')

async function benchmark (benchmarker) {
  const ipfs = await Ipfs.create({ repo: benchmarker.dir + '/ipfs' })
  const { log, identity, access } = await createLog(ipfs, 'A')

  await appendEntries(log, height, { refCount: 64 })

  benchmarker.trackMemory()
  benchmarker.startRecording()
  await Log.fromEntryHash(ipfs, identity, log.heads.map(e => e.hash), { access, logId: log._id })
  benchmarker.stopRecording()

  await ipfs.stop()
}

module.exports = {
  benchmark
}
