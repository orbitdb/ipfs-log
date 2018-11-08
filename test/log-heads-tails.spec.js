'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const Keystore = require('orbit-db-keystore')
const Entry = require('../src/entry')
const Log = require('../src/log')
const { AccessController, IdentityProvider } = Log

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

    const testACL = new AccessController()
    const keystore = Keystore.create(config.testKeysPath)
    const identitySignerFn = async (id, data) => {
      const key = await keystore.getKey(id)
      return keystore.sign(key, data)
    }
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, {
      repo: config.defaultIpfsConfig.repo + '-log-head-and-tails' + new Date().getTime()
    })

    before(async () => {
      rmrf.sync(ipfsConfig.repo)
      testIdentity = await IdentityProvider.createIdentity(keystore, 'userA', { identitySignerFn })
      testIdentity2 = await IdentityProvider.createIdentity(keystore, 'userB', { identitySignerFn })
      testIdentity3 = await IdentityProvider.createIdentity(keystore, 'userC', { identitySignerFn })
      testIdentity4 = await IdentityProvider.createIdentity(keystore, 'userD', { identitySignerFn })
      ipfs = await startIpfs(IPFS, ipfsConfig)
    })

    after(async () => {
      await stopIpfs(ipfs)
      rmrf.sync(ipfsConfig.repo)
    })

    describe('heads', () => {
      it('finds one head after one entry', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        await log1.append('helloA1')
        assert.strictEqual(log1.heads.length, 1)
      })

      it('finds one head after two entries', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        await log1.append('helloA1')
        await log1.append('helloA2')
        assert.strictEqual(log1.heads.length, 1)
      })

      it('log contains the head entry', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        await log1.append('helloA1')
        await log1.append('helloA2')
        assert.deepStrictEqual(log1.get(log1.heads[0].hash), log1.heads[0])
      })

      it('finds head after a join and append', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        let log2 = new Log(ipfs, testACL, testIdentity, 'A')

        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')

        await log2.join(log1)
        await log2.append('helloB2')
        const expectedHead = last(log2.values)

        assert.strictEqual(log2.heads.length, 1)
        assert.deepStrictEqual(log2.heads[0].hash, expectedHead.hash)
      })

      it('finds two heads after a join', async () => {
        let log2 = new Log(ipfs, testACL, testIdentity, 'A')
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')

        await log1.append('helloA1')
        await log1.append('helloA2')
        const expectedHead1 = last(log1.values)

        await log2.append('helloB1')
        await log2.append('helloB2')
        const expectedHead2 = last(log2.values)

        await log1.join(log2)

        const heads = log1.heads
        assert.strictEqual(heads.length, 2)
        assert.strictEqual(heads[0].hash, expectedHead1.hash)
        assert.strictEqual(heads[1].hash, expectedHead2.hash)
      })

      it('finds two heads after two joins', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        let log2 = new Log(ipfs, testACL, testIdentity, 'A')

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
        assert.strictEqual(heads[0].hash, expectedHead1.hash)
        assert.strictEqual(heads[1].hash, expectedHead2.hash)
      })

      it('finds two heads after three joins', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        let log2 = new Log(ipfs, testACL, testIdentity, 'A')
        let log3 = new Log(ipfs, testACL, testIdentity, 'A')

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
        assert.strictEqual(heads[0].hash, expectedHead1.hash)
        assert.strictEqual(heads[1].hash, expectedHead2.hash)
      })

      it('finds three heads after three joins', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        let log2 = new Log(ipfs, testACL, testIdentity, 'A')
        let log3 = new Log(ipfs, testACL, testIdentity, 'A')

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
        assert.deepStrictEqual(heads[0].hash, expectedHead1.hash)
        assert.deepStrictEqual(heads[1].hash, expectedHead2.hash)
        assert.deepStrictEqual(heads[2].hash, expectedHead3.hash)
      })
    })

    describe('tails', () => {
      it('returns a tail', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        await log1.append('helloA1')
        assert.strictEqual(log1.tails.length, 1)
      })

      it('tail is a Entry', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        await log1.append('helloA1')
        assert.strictEqual(Entry.isEntry(log1.tails[0]), true)
      })

      it('returns tail entries', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        let log2 = new Log(ipfs, testACL, testIdentity, 'A')
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log1.join(log2)
        assert.strictEqual(log1.tails.length, 2)
        assert.strictEqual(Entry.isEntry(log1.tails[0]), true)
        assert.strictEqual(Entry.isEntry(log1.tails[1]), true)
      })

      it('returns tail hashes', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        let log2 = new Log(ipfs, testACL, testIdentity, 'A')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2, 2)
        assert.strictEqual(log1.tailHashes.length, 2)
      })

      it('returns no tail hashes if all entries point to empty nexts', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        let log2 = new Log(ipfs, testACL, testIdentity, 'A')
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log1.join(log2)
        assert.strictEqual(log1.tailHashes.length, 0)
      })

      it('returns tails after loading a partial log', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'A')
        let log2 = new Log(ipfs, testACL, testIdentity2, 'A')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        const log4 = await Log.fromEntry(ipfs, testACL, testIdentity, log1.heads, 2)
        assert.strictEqual(log4.length, 2)
        assert.strictEqual(log4.tails.length, 2)
        assert.strictEqual(log4.tails[0].hash, log4.values[0].hash)
        assert.strictEqual(log4.tails[1].hash, log4.values[1].hash)
      })

      it('returns tails sorted by id', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity2, 'XX')
        let log2 = new Log(ipfs, testACL, testIdentity3, 'XX')
        let log3 = new Log(ipfs, testACL, testIdentity, 'XX')
        let log4 = new Log(ipfs, testACL, testIdentity4, 'XX')
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
