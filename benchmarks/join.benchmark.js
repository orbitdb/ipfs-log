'use strict'
const Ipfs = require('ipfs')
const { createLog, height } = require('./utils')

async function benchmark (benchmarker) {
  const ipfs = await Ipfs.create({ repo: benchmarker.dir + '/ipfs' })
  const { log: logA } = await createLog(ipfs, 'A')
  const { log: logB } = await createLog(ipfs, 'B')

  benchmarker.trackMemory()
  benchmarker.startRecording()
  for (let i = 0; i < height; i++) {
    const now = Date.now()
    await Promise.all([logA.append(now), logB.append(now)])
    await Promise.all([logA.join(logB), logB.join(logA)])
  }
  benchmarker.stopRecording()

  await ipfs.stop()
}

module.exports = {
  benchmark
}
