const { startIpfs, stopIpfs, config } = require('orbit-db-test-utils')
const createLog = require('./utils/create-log')

const base = {
  prepare: async function () {
    const ipfsd = await startIpfs('js-ipfs', config)
    const { log } = await createLog(ipfsd.api, 'A')
    return { log, ipfsd }
  },
  cycle: async function ({ log }) {
    await log.append('Hello', 32)
  },
  teardown: async function ({ ipfsd }) {
    await stopIpfs(ipfsd)
  }
}

const baseline = {
  while: ({ stats, startTime, baselineLimit }) => {
    return stats.count < baselineLimit
  }
}

const stress = {
  while: ({ stats, startTime, stressLimit }) => {
    return process.hrtime(startTime)[0] < stressLimit
  }
}

module.exports = [
  { name: 'append-baseline', ...base, ...baseline },
  { name: 'append-stress', ...base, ...stress }
]
