'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const EntryIO = require('../src/entry-io')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')

// Test utils
const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('./utils')

let ipfs, testIdentity, testIdentity2, testIdentity3, testIdentity4

const last = arr => arr[arr.length - 1]

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Entry - Persistency (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeysPath, signingKeysPath } = config
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, {
      repo: config.defaultIpfsConfig.repo + '-entry-io' + new Date().getTime()
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

    it('log with one entry', async () => {
      let log = new Log(ipfs, testIdentity, { logId: 'X' })
      await log.append('one')
      const cid = log.values[0].cid
      const res = await EntryIO.fetchAll(ipfs, cid, 1)
      assert.strictEqual(res.length, 1)
    })

    it('log with 2 entries', async () => {
      let log = new Log(ipfs, testIdentity, { logId: 'X' })
      await log.append('one')
      await log.append('two')
      const cid = last(log.values).cid
      const res = await EntryIO.fetchAll(ipfs, cid, 2)
      assert.strictEqual(res.length, 2)
    })

    it('loads max 1 entry from a log of 2 entry', async () => {
      let log = new Log(ipfs, testIdentity, { logId: 'X' })
      await log.append('one')
      await log.append('two')
      const cid = last(log.values).cid
      const res = await EntryIO.fetchAll(ipfs, cid, { length: 1 })
      assert.strictEqual(res.length, 1)
    })

    it('log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, testIdentity, { logId: 'X' })
      for (let i = 0; i < count; i++) {
        await log.append('hello' + i)
      }

      const cid = await log.toCID()
      const result = await Log.fromCID(ipfs, testIdentity, cid, -1)
      assert.strictEqual(result.length, count)
    })

    it('load only 42 entries from a log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, testIdentity, { logId: 'X' })
      let log2 = new Log(ipfs, testIdentity, { logId: 'X' })
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          log2 = new Log(ipfs, testIdentity,
            { logId: log2.id, entries: log2.values, heads: log2.heads.concat(log.heads) })
          await log2.append('hi' + i)
        }
      }

      const cid = await log.toCID()
      const result = await Log.fromCID(ipfs, testIdentity, cid, { length: 42 })
      assert.strictEqual(result.length, 42)
    })

    it('load only 99 entries from a log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, testIdentity, { logId: 'X' })
      let log2 = new Log(ipfs, testIdentity, { logId: 'X' })
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          log2 = new Log(ipfs, testIdentity, { logId: log2.id, entries: log2.values })
          await log2.append('hi' + i)
          await log2.join(log)
        }
      }

      const cid = await log2.toCID()
      const result = await Log.fromCID(ipfs, testIdentity, cid, { length: 99 })
      assert.strictEqual(result.length, 99)
    })

    it('load only 10 entries from a log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, testIdentity, { logId: 'X' })
      let log2 = new Log(ipfs, testIdentity, { logId: 'X' })
      let log3 = new Log(ipfs, testIdentity, { logId: 'X' })
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          log2 = new Log(ipfs, testIdentity,
            { logId: log2.id, entries: log2.values, heads: log2.heads })
          await log2.append('hi' + i)
          await log2.join(log)
        }
        if (i % 25 === 0) {
          log3 = new Log(ipfs, testIdentity,
            { logId: log3.id, entries: log3.values, heads: log3.heads.concat(log2.heads) })
          await log3.append('--' + i)
        }
      }

      await log3.join(log2)
      const cid = await log3.toCID()
      const result = await Log.fromCID(ipfs, testIdentity, cid, { length: 10 })
      assert.strictEqual(result.length, 10)
    })

    it('load only 10 entries and then expand to max from a log with 100 entries', async () => {
      const count = 30

      let log = new Log(ipfs, testIdentity, { logId: 'X' })
      let log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
      let log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          await log2.append('hi' + i)
          await log2.join(log)
        }
        if (i % 25 === 0) {
          log3 = new Log(ipfs, testIdentity3,
            { logId: log3.id, entries: log3.values, heads: log3.heads.concat(log2.heads) })
          await log3.append('--' + i)
        }
      }

      await log3.join(log2)

      const log4 = new Log(ipfs, testIdentity4, { logId: 'X' })
      await log4.join(log2)
      await log4.join(log3)

      const values3 = log3.values.map((e) => e.payload)
      const values4 = log4.values.map((e) => e.payload)

      assert.deepStrictEqual(values3, values4)
    })
  })
})
