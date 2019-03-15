'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const Entry = require('../src/entry')
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

const last = (arr) => {
  return arr[arr.length - 1]
}

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - Heads and Tails (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeysPath, signingKeysPath } = config
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, {
      repo: config.defaultIpfsConfig.repo + '-log-head-and-tails' + new Date().getTime()
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

    describe('heads', () => {
      it('finds one head after one entry', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        assert.strictEqual(log1.heads.length, 1)
      })

      it('finds one head after two entries', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        assert.strictEqual(log1.heads.length, 1)
      })

      it('log contains the head entry', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        assert.deepStrictEqual(log1.get(log1.heads[0].cid), log1.heads[0])
      })

      it('finds head after a join and append', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log2 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')

        await log2.join(log1)
        await log2.append('helloB2')
        const expectedHead = last(log2.values)

        assert.strictEqual(log2.heads.length, 1)
        assert.deepStrictEqual(log2.heads[0].cid, expectedHead.cid)
      })

      it('finds two heads after a join', async () => {
        let log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        const expectedHead1 = last(log1.values)

        await log2.append('helloB1')
        await log2.append('helloB2')
        const expectedHead2 = last(log2.values)

        await log1.join(log2)

        const heads = log1.heads
        assert.strictEqual(heads.length, 2)
        assert.strictEqual(heads[0].cid, expectedHead2.cid)
        assert.strictEqual(heads[1].cid, expectedHead1.cid)
      })

      it('finds two heads after two joins', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log2 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')

        await log2.append('helloB1')
        await log2.append('helloB2')

        await log1.join(log2)

        await log2.append('helloB3')

        await log1.append('helloA3')
        await log1.append('helloA4')
        const expectedHead2 = last(log2.values)
        const expectedHead1 = last(log1.values)

        await log1.join(log2)

        const heads = log1.heads
        assert.strictEqual(heads.length, 2)
        assert.strictEqual(heads[0].cid, expectedHead1.cid)
        assert.strictEqual(heads[1].cid, expectedHead2.cid)
      })

      it('finds two heads after three joins', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log3 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        await log1.append('helloA3')
        await log1.append('helloA4')
        const expectedHead1 = last(log1.values)
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log2.join(log3)
        await log2.append('helloB3')
        const expectedHead2 = last(log2.values)
        await log1.join(log2)

        const heads = log1.heads
        assert.strictEqual(heads.length, 2)
        assert.strictEqual(heads[0].cid, expectedHead1.cid)
        assert.strictEqual(heads[1].cid, expectedHead2.cid)
      })

      it('finds three heads after three joins', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log3 = new Log(ipfs, testIdentity, { logId: 'A' })

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        await log1.append('helloA3')
        await log1.append('helloA4')
        const expectedHead1 = last(log1.values)
        await log3.append('helloC1')
        await log2.append('helloB3')
        await log3.append('helloC2')
        const expectedHead2 = last(log2.values)
        const expectedHead3 = last(log3.values)
        await log1.join(log2)
        await log1.join(log3)

        const heads = log1.heads
        assert.strictEqual(heads.length, 3)
        assert.deepStrictEqual(heads[0].cid, expectedHead1.cid)
        assert.deepStrictEqual(heads[1].cid, expectedHead2.cid)
        assert.deepStrictEqual(heads[2].cid, expectedHead3.cid)
      })
    })

    describe('tails', () => {
      it('returns a tail', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        assert.strictEqual(log1.tails.length, 1)
      })

      it('tail is a Entry', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        assert.strictEqual(Entry.isEntry(log1.tails[0]), true)
      })

      it('returns tail entries', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log1.join(log2)
        assert.strictEqual(log1.tails.length, 2)
        assert.strictEqual(Entry.isEntry(log1.tails[0]), true)
        assert.strictEqual(Entry.isEntry(log1.tails[1]), true)
      })

      it('returns tail cids', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2, 2)
        assert.strictEqual(log1.tailCids.length, 2)
      })

      it('returns no tail cids if all entries point to empty nexts', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log2 = new Log(ipfs, testIdentity, { logId: 'A' })
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log1.join(log2)
        assert.strictEqual(log1.tailCids.length, 0)
      })

      it('returns tails after loading a partial log', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
        let log2 = new Log(ipfs, testIdentity2, { logId: 'A' })
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        const log4 = await Log.fromEntry(ipfs, testIdentity, log1.heads, { length: 2 })
        assert.strictEqual(log4.length, 2)
        assert.strictEqual(log4.tails.length, 2)
        assert.strictEqual(log4.tails[0].cid, log4.values[0].cid)
        assert.strictEqual(log4.tails[1].cid, log4.values[1].cid)
      })

      it('returns tails sorted by id', async () => {
        let log1 = new Log(ipfs, testIdentity2, { logId: 'XX' })
        let log2 = new Log(ipfs, testIdentity3, { logId: 'XX' })
        let log3 = new Log(ipfs, testIdentity, { logId: 'XX' })
        let log4 = new Log(ipfs, testIdentity4, { logId: 'XX' })
        await log1.append('helloX1')
        await log2.append('helloB1')
        await log3.append('helloA1')
        await log3.join(log1)
        await log3.join(log2)
        await log4.join(log3)
        assert.strictEqual(log4.tails.length, 3)
        assert.strictEqual(log4.tails[0].id, 'XX')
        assert.strictEqual(log4.tails[0].clock.id, testIdentity.publicKey)
        assert.strictEqual(log4.tails[1].clock.id, testIdentity3.publicKey)
        assert.strictEqual(log4.tails[2].clock.id, testIdentity2.publicKey)
        assert.strictEqual(log4.clock.id, testIdentity4.publicKey)
      })
    })
  })
})
