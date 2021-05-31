'use strict'
const Ipfs = require('ipfs')
const Log = require('../src/log')
const { createLog, height, appendEntries } = require('./utils')

async function benchmark (benchmarker) {
  const ipfs = await Ipfs.create({ repo: benchmarker.dir + '/ipfs' })
  const { log } = await createLog(ipfs, 'A')

  const { entries } = await appendEntries(log, height, { withEntries: true })

  benchmarker.startRecording()
  Log.findHeads(entries)
  benchmarker.stopRecording()

  await ipfs.stop()
}

module.exports = {
  benchmark
}
