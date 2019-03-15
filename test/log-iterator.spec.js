'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')
const LogCreator = require('./utils/log-creator')

// Test utils
const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('./utils')

let ipfs, testIdentity, testIdentity2, testIdentity3, testIdentity4

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - Iterator (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeysPath, signingKeysPath } = config
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, {
      repo: config.defaultIpfsConfig.repo + '-log-join' + new Date().getTime()
    })

    before(async () => {
      rmrf.sync(ipfsConfig.repo)
      testIdentity = await IdentityProvider.createIdentity({ id: 'userA', identityKeysPath, signingKeysPath })
      testIdentity2 = await IdentityProvider.createIdentity({ id: 'userB', identityKeysPath, signingKeysPath })
      testIdentity3 = await IdentityProvider.createIdentity({ id: 'userC', identityKeysPath, signingKeysPath })
      testIdentity4 = await IdentityProvider.createIdentity({ id: 'userD', identityKeysPath, signingKeysPath })
      ipfs = await startIpfs(IPFS, ipfsConfig)
    })

    after(async () => {
      await stopIpfs(ipfs)
      rmrf.sync(ipfsConfig.repo)
    })

    describe('Basic iterator functionality', () => {
      let log1

      beforeEach(async () => {
        log1 = new Log(ipfs, testIdentity, { logId: 'X' })

        for (let i = 0; i <= 100; i++) {
          await log1.append('entry' + i)
        }
      })

      it('returns a Symbol.iterator object', async () => {
        let it = log1.iterator({
          lte: 'zdpuApFd5XAPkCTmSx7qWQmQzvtdJPtx2K5p9to6ytCS79bfk',
          amount: 0
        })

        assert.strictEqual(typeof it[Symbol.iterator], 'function')
        assert.deepStrictEqual(it.next(), { value: undefined, done: true })
      })

      it('returns length with lte and amount', async () => {
        let amount = 10

        let it = log1.iterator({
          lte: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL',
          amount: amount
        })

        assert.strictEqual([...it].length, 10)
      })

      it('returns entries with lte and amount', async () => {
        let amount = 10

        let it = log1.iterator({
          lte: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL',
          amount: amount
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (67 - i++))
        }
      })

      it('returns length with lt and amount', async () => {
        let amount = 10

        let it = log1.iterator({
          lt: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL',
          amount: amount
        })

        assert.strictEqual([...it].length, amount)
      })

      it('returns entries with lt and amount', async () => {
        let amount = 10

        let it = log1.iterator({
          lt: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL',
          amount: amount
        })

        let i = 1
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (67 - i++))
        }
      })

      it('returns correct length with gt and amount', async () => {
        let amount = 5

        let it = log1.iterator({
          gt: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL',
          amount: amount
        })

        let i = 0
        let count = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (72 - i++))
          count++
        }
        assert.strictEqual(count, amount)
      })

      it('returns length with gte and amount', async () => {
        let amount = 12

        let it = log1.iterator({
          gt: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL',
          amount: amount
        })

        assert.strictEqual([...it].length, amount)
      })

      it('returns entries with gte and amount', async () => {
        let amount = 12

        let it = log1.iterator({
          gt: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL',
          amount: amount
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (79 - i++))
        }
      })

      /* eslint-disable camelcase */
      it('iterates with lt and gt', async () => {
        let it = log1.iterator({
          gt: 'zdpuAvZ6cDrY57iDxEQ5iSXibAeJPcBFD1jHnAmKq1RUiyuoK',
          lt: 'zdpuAuPfNkZmPdMxbyw1MxEwuv3XdrMMtFaTSi7sgc7j8VnzW'
        })
        let hashes = [...it].map(e => e.hash)

        // neither hash should appear in the array
        assert.strictEqual(hashes.indexOf('zdpuAvZ6cDrY57iDxEQ5iSXibAeJPcBFD1jHnAmKq1RUiyuoK'), -1)
        assert.strictEqual(hashes.indexOf('zdpuAuPfNkZmPdMxbyw1MxEwuv3XdrMMtFaTSi7sgc7j8VnzW'), -1)
        assert.strictEqual(hashes.length, 10)
      })

      it('iterates with lt and gte', async () => {
        let it = log1.iterator({
          gte: 'zdpuAyw2rPe5ML6YmYe7DEyAq3CbWH3QpWQ4P6F4ZFroEebzz',
          lt: 'zdpuAxv8bUaFNmCp51zN3AwCLy83FfVCcp7GeTwCdtpVddziP'
        })
        let hashes = [...it].map(e => e.hash)

        // only the gte hash should appear in the array
        assert.strictEqual(hashes.indexOf('zdpuAyw2rPe5ML6YmYe7DEyAq3CbWH3QpWQ4P6F4ZFroEebzz'), 24)
        assert.strictEqual(hashes.indexOf('zdpuAxv8bUaFNmCp51zN3AwCLy83FfVCcp7GeTwCdtpVddziP'), -1)
        assert.strictEqual(hashes.length, 25)
      })

      it('iterates with lte and gt', async () => {
        let it = log1.iterator({
          gt: 'zdpuApQ4crttH3GmnVQPNdZ5UMNv3aCd3bcccFEKYCAdYUzir',
          lte: 'zdpuAxdV4PTwMZ4Ug2r9Y1Vi48EUJW4YZPnaWZW9kSfbR82SF'
        })
        let hashes = [...it].map(e => e.hash)

        // only the lte hash should appear in the array
        assert.strictEqual(hashes.indexOf('zdpuApQ4crttH3GmnVQPNdZ5UMNv3aCd3bcccFEKYCAdYUzir'), -1)
        assert.strictEqual(hashes.indexOf('zdpuAxdV4PTwMZ4Ug2r9Y1Vi48EUJW4YZPnaWZW9kSfbR82SF'), 0)
        assert.strictEqual(hashes.length, 4)
      })

      it('iterates with lte and gte', async () => {
        let it = log1.iterator({
          gte: 'zdpuAmAvVqqHiss5arZoY6oNDN6JRLVExfWyN48rxTrsscHaE',
          lte: 'zdpuApYv1r3kPGdSJoDYA8xkEAzKFK3bdvrdRX4jY13xZDpL6'
        })
        let hashes = [...it].map(e => e.hash)

        // neither hash should appear in the array
        assert.strictEqual(hashes.indexOf('zdpuAmAvVqqHiss5arZoY6oNDN6JRLVExfWyN48rxTrsscHaE'), 9)
        assert.strictEqual(hashes.indexOf('zdpuApYv1r3kPGdSJoDYA8xkEAzKFK3bdvrdRX4jY13xZDpL6'), 0)
        assert.strictEqual(hashes.length, 10)
      })

      it('returns length with gt and default amount', async () => {
        let it = log1.iterator({
          gt: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL'
        })

        assert.strictEqual([...it].length, 33)
      })

      it('returns entries with gt and default amount', async () => {
        let it = log1.iterator({
          gt: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL'
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (100 - i++))
        }
      })

      it('returns length with gte and default amount', async () => {
        let it = log1.iterator({
          gte: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL'
        })

        assert.strictEqual([...it].length, 34)
      })

      it('returns entries with gte and default amount', async () => {
        let it = log1.iterator({
          gte: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL'
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (100 - i++))
        }
      })

      it('returns length with lt and default amount value', async () => {
        let it = log1.iterator({
          lt: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL'
        })

        assert.strictEqual([...it].length, 67)
      })

      it('returns entries with lt and default amount value', async () => {
        let it = log1.iterator({
          lt: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL'
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (66 - i++))
        }
      })

      it('returns length with lte and default amount value', async () => {
        let it = log1.iterator({
          lte: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL'
        })

        assert.strictEqual([...it].length, 68)
      })

      it('returns entries with lte and default amount value', async () => {
        let it = log1.iterator({
          lte: 'zdpuAx5FC3cgoQSW7oXpBw6x4YiuDuaF9BBgncguzvndP8tDL'
        })

        let i = 0
        for (let entry of it) {
          assert.strictEqual(entry.payload, 'entry' + (67 - i++))
        }
      })
    })

    describe('Iteration over forked/joined logs', () => {
      let fixture, identities

      before(async () => {
        identities = [testIdentity, testIdentity2, testIdentity3, testIdentity4]
        fixture = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
      })

      it('returns the full length from all heads', async () => {
        let it = fixture.log.iterator({
          lte: fixture.log.heads
        })

        assert.strictEqual([...it].length, 16)
      })

      it('returns partial entries from all heads', async () => {
        let it = fixture.log.iterator({
          lte: fixture.log.heads,
          amount: 6
        })

        assert.deepStrictEqual([...it].map(e => e.payload),
          ['entryA10', 'entryA9', 'entryA8', 'entryA7', 'entryC0', 'entryA6'])
      })

      it('returns partial logs from single heads #1', async () => {
        let it = fixture.log.iterator({
          lte: [fixture.log.heads[0]]
        })

        assert.strictEqual([...it].length, 10)
      })

      it('returns partial logs from single heads #2', async () => {
        let it = fixture.log.iterator({
          lte: [fixture.log.heads[1]]
        })

        assert.strictEqual([...it].length, 11)
      })

      it('throws error if lt/lte not a string or array of entries', async () => {
        let errMsg

        try {
          fixture.log.iterator({
            lte: fixture.log.heads[1]
          })
        } catch (e) {
          errMsg = e.message
        }

        assert.strictEqual(errMsg, 'lt or lte must be a string or array of Entries')
      })
    })
  })
})
