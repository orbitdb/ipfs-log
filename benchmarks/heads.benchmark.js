'use strict'
const Ipfs = require('ipfs')
const { createLog, height, appendEntries } = require('./utils')

async function benchmark (benchmarker) {
  const ipfs = await Ipfs.create({ repo: benchmarker.dir + '/ipfs' })
  const { log } = await createLog(ipfs, 'A')

  await appendEntries(log, height)

  const cycle = () => log.heads
  benchmarker.startRecording()
  for (let i = 0; i < height; i++) {
    cycle()
  }
  benchmarker.stopRecording()

  await ipfs.stop()
}

module.exports = {
  benchmark
}
