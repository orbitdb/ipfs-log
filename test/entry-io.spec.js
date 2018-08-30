'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const Log = require('../src/log')
const EntryIO = require('../src/entry-io')
const { AccessController, IdentityProvider, Keystore } = Log
const startIpfs = require('./utils/start-ipfs')

const apis = [require('ipfs')]

const dataDir = './ipfs/tests/fetch'

const repoConf = {
  storageBackends: {
    blocks: DatastoreLevel
  }
}

const ipfsConf = {
  repo: new IPFSRepo(dataDir, repoConf),
  EXPERIMENTAL: {
    pubsub: true,
    dht: false,
    sharding: false
  }
}

let ipfs, testIdentity, testIdentity2, testIdentity3, testIdentity4

const last = arr => arr[arr.length - 1]

apis.forEach((IPFS) => {
  describe('Entry - Persistency', function () {
    this.timeout(20000)
    const testKeysPath = './test/fixtures/keys'
    const keystore = Keystore.create(testKeysPath)
    const identitySignerFn = async (id, data) => {
      const key = await keystore.getKey(id)
      return keystore.sign(key, data)
    }
    const testACL = new AccessController()

    before(async () => {
      rmrf.sync(dataDir)
      testIdentity = await IdentityProvider.createIdentity(keystore, 'userA', identitySignerFn)
      testIdentity2 = await IdentityProvider.createIdentity(keystore, 'userB', identitySignerFn)
      testIdentity3 = await IdentityProvider.createIdentity(keystore, 'userC', identitySignerFn)
      testIdentity4 = await IdentityProvider.createIdentity(keystore, 'userD', identitySignerFn)

      ipfs = await startIpfs(IPFS, ipfsConf)
    })

    after(async () => {
      if (ipfs) {
        await ipfs.stop()
      }
      rmrf.sync(dataDir)
    })

    it('log with one entry', async () => {
      let log = new Log(ipfs, testACL, testIdentity, 'X')
      await log.append('one')
      const hash = log.values[0].hash
      const res = await EntryIO.fetchAll(ipfs, hash, 1)
      assert.strictEqual(res.length, 1)
    })

    it('log with 2 entries', async () => {
      let log = new Log(ipfs, testACL, testIdentity, 'X')
      await log.append('one')
      await log.append('two')
      const hash = last(log.values).hash
      const res = await EntryIO.fetchAll(ipfs, hash, 2)
      assert.strictEqual(res.length, 2)
    })

    it('loads max 1 entriy from a log of 2 entry', async () => {
      let log = new Log(ipfs, testACL, testIdentity, 'X')
      await log.append('one')
      await log.append('two')
      const hash = last(log.values).hash
      const res = await EntryIO.fetchAll(ipfs, hash, 1)
      assert.strictEqual(res.length, 1)
    })

    it('log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, testACL, testIdentity, 'X')
      for (let i = 0; i < count; i++) {
        await log.append('hello' + i)
      }

      const hash = await log.toMultihash()
      const result = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, -1)
      assert.strictEqual(result.length, count)
    })

    it('load only 42 entries from a log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, testACL, testIdentity, 'X')
      let log2 = new Log(ipfs, testACL, testIdentity, 'X')
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          log2 = new Log(ipfs, testACL, testIdentity, log2.id, log2.values, log2.heads.concat(log.heads))
          await log2.append('hi' + i)
        }
      }

      const hash = await log.toMultihash()
      const result = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, 42)
      assert.strictEqual(result.length, 42)
    })

    it('load only 99 entries from a log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, testACL, testIdentity, 'X')
      let log2 = new Log(ipfs, testACL, testIdentity, 'X')
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          log2 = new Log(ipfs, testACL, testIdentity, log2.id, log2.values)
          await log2.append('hi' + i)
          log2.join(log)
        }
      }

      const hash = await log2.toMultihash()
      const result = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, 99)
      assert.strictEqual(result.length, 99)
    })

    it('load only 10 entries from a log with 100 entries', async () => {
      const count = 100
      let log = new Log(ipfs, testACL, testIdentity, 'X')
      let log2 = new Log(ipfs, testACL, testIdentity, 'X')
      let log3 = new Log(ipfs, testACL, testIdentity, 'X')
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          log2 = new Log(ipfs, testACL, testIdentity, log2.id, log2.values, log2.heads)
          await log2.append('hi' + i)
          await log2.join(log)
        }
        if (i % 25 === 0) {
          log3 = new Log(ipfs, testACL, testIdentity, log3.id, log3.values, log3.heads.concat(log2.heads))
          await log3.append('--' + i)
        }
      }

      await log3.join(log2)
      const hash = await log3.toMultihash()
      const result = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, 10)
      assert.strictEqual(result.length, 10)
    })

    it('load only 10 entries and then expand to max from a log with 100 entries', async () => {
      const count = 30

      let log = new Log(ipfs, testACL, testIdentity, 'X')
      let log2 = new Log(ipfs, testACL, testIdentity2, 'X')
      let log3 = new Log(ipfs, testACL, testIdentity3, 'X')
      for (let i = 1; i <= count; i++) {
        await log.append('hello' + i)
        if (i % 10 === 0) {
          await log2.append('hi' + i)
          await log2.join(log)
        }
        if (i % 25 === 0) {
          log3 = new Log(ipfs, testACL, testIdentity3, log3.id, log3.values, log3.heads.concat(log2.heads))
          await log3.append('--' + i)
        }
      }

      await log3.join(log2)

      const log4 = new Log(ipfs, testACL, testIdentity4, 'X')
      await log4.join(log2)
      await log4.join(log3)

      const values3 = log3.values.map((e) => e.payload)
      const values4 = log4.values.map((e) => e.payload)

      assert.deepStrictEqual(values3, values4)
    })
  })
})
