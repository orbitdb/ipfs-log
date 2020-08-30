const { startIpfs, stopIpfs, config } = require('orbit-db-test-utils')
const createLog = require('./utils/create-log')

const base = {
  prepare: async function () {
    const ipfsd = await startIpfs('js-ipfs', config)
    const { log: logA } = await createLog(ipfsd.api, 'A')
    const { log: logB } = await createLog(ipfsd.api, 'B')
    return { logA, logB, ipfsd }
  },
  cycle: async function ({ logA, logB }) {
    const add1 = await logA.append('Hello1')
    const add2 = await logB.append('Hello2')

    await Promise.all([add1, add2])
    logA.join(logB)
    logB.join(logA)
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
  { name: 'join-baseline', ...base, ...baseline },
  { name: 'join-stress', ...base, ...stress }
]
