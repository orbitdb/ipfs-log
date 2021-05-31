'use strict'
const Ipfs = require('ipfs')
const { createLog, height } = require('./utils')

async function benchmark (benchmarker) {
  const ipfs = await Ipfs.create({ repo: benchmarker.dir + '/ipfs' })
  const { log } = await createLog(ipfs, 'A')

  let i = 0
  let appends = 0
  benchmarker.trackMemory()
  benchmarker.addMetric({
    name: 'appends',
    get: () => i
  })
  benchmarker.addMetric({
    name: 'appends per second',
    get: () => {
      const perSecond = i - appends
      appends = i
      return perSecond
    }
  })

  benchmarker.log('appending the log...')
  benchmarker.startRecording()
  for (; i < height; i++) {
    await log.append(Date.now(), 32)
  }
  benchmarker.stopRecording()

  await ipfs.stop()
}

module.exports = {
  benchmark
}
