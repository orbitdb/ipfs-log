'use strict'
const Ipfs = require('ipfs')
const { createLog, height, appendEntries } = require('./utils')

async function benchmark (benchmarker) {
  const ipfs = await Ipfs.create({ repo: benchmarker.dir + '/ipfs' })
  const { log } = await createLog(ipfs, 'A')

  await appendEntries(log, height)
  const values = log.values

  benchmarker.startRecording()
  for (const { hash } of values) {
    log.get(hash)
  }
  benchmarker.stopRecording()

  await ipfs.stop()
}

module.exports = {
  benchmark
}
