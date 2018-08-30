'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const Log = require('../src/log')
const { AccessController, IdentityProvider, Keystore } = Log
const startIpfs = require('./utils/start-ipfs')

const apis = [require('ipfs')]
const dataDir = './ipfs/tests/log'

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

let ipfs, testIdentity, testIdentity2

apis.forEach((IPFS) => {
  describe('Signed Log', function () {
    this.timeout(10000)

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
      ipfs = await startIpfs(IPFS, ipfsConf)
    })

    after(async () => {
      if (ipfs) {
        await ipfs.stop()
      }
      rmrf.sync(dataDir)
    })

    it('creates a signed log', () => {
      const log = new Log(ipfs, testACL, testIdentity, 'A')
      assert.notStrictEqual(log.id, null)
      assert.strictEqual(log._identity.id, testIdentity.id)
    })

    it('has the correct identity', () => {
      const log = new Log(ipfs, testACL, testIdentity, 'A')
      assert.notStrictEqual(log.id, null)
      assert.strictEqual(log._identity.id, 'userA')
      assert.strictEqual(log._identity.publicKey, '042750228c5d81653e5142e6a56d5551231649160f77b25797dc427f8a5b2afd650acca10182f0dfc519dc6d6e5216b9a6612dbfc56e906bdbf34ea373c92b30d7')
      assert.strictEqual(log._identity.pkSignature, '30440220590c0b1a84d5edabf4238ea924ad06481a47ba7f866d88d5950e89ee53670d04022068896f4d850297051c6b1acd5edb8d9dacc0a8fa3d11f436b79e193d14236a05')
      assert.strictEqual(log._identity.signature, '304502210083bee84a2ecab7df452e0642b5d6f84ecc1c33927eac26049111bea64dfc0b8102202ef96123734077f171e211f21f632006a7cdce9d5757ea7c4edd4d54eadbe5d4')
    })

    it('has the correct public key', () => {
      const log = new Log(ipfs, testACL, testIdentity, 'A')
      assert.notStrictEqual(log.id, null)
      assert.strictEqual(log._identity.id, testIdentity.id)
    })

    it('has the correct pkSignature', () => {
      const log = new Log(ipfs, testACL, testIdentity, 'A')
      assert.notStrictEqual(log.id, null)
      assert.strictEqual(log._identity.id, testIdentity.id)
    })

    it('entries contain a signature and a public signing key', async () => {
      const log = new Log(ipfs, testACL, testIdentity, 'A')
      await log.append('one')
      assert.notStrictEqual(log.values[0].sig, null)
      assert.deepStrictEqual(log.values[0].identity, testIdentity.toJSON())
    })

    it('doesn\'t sign entries when access controller is not defined', async () => {
      let err
      try {
        const log = new Log(ipfs) // eslint-disable-line no-unused-vars
      } catch (e) {
        err = e.toString()
      }
      assert.strictEqual(err, 'Error: Access controller is required')
    })

    it('doesn\'t join logs with different IDs ', async () => {
      const log1 = new Log(ipfs, testACL, testIdentity, 'A')
      const log2 = new Log(ipfs, testACL, testIdentity2, 'B')

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        await log2.append('three')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
        throw e
      }
      assert.strictEqual(err, undefined)
      assert.strictEqual(log1.id, 'A')
      assert.strictEqual(log1.values.length, 1)
      assert.strictEqual(log1.values[0].payload, 'one')
    })

    it('throws an error if log is signed but trying to merge with an entry that doesn\'t have public signing key', async () => {
      const log1 = new Log(ipfs, testACL, testIdentity, 'A')
      const log2 = new Log(ipfs, testACL, testIdentity2, 'A')

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        delete log2.values[0].key
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }
      assert.strictEqual(err, 'Error: Entry doesn\'t have a key')
    })

    it('throws an error if log is signed but trying to merge an entry that doesn\'t have a signature', async () => {
      const log1 = new Log(ipfs, testACL, testIdentity, 'A')
      const log2 = new Log(ipfs, testACL, testIdentity2, 'A')

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        delete log2.values[0].sig
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }
      assert.strictEqual(err, 'Error: Entry doesn\'t have a signature')
    })

    it('throws an error if log is signed but the signature doesn\'t verify', async () => {
      const replaceAt = (str, index, replacement) => {
        return str.substr(0, index) + replacement + str.substr(index + replacement.length)
      }

      const log1 = new Log(ipfs, testACL, testIdentity, 'A')
      const log2 = new Log(ipfs, testACL, testIdentity2, 'A')
      let err

      try {
        await log1.append('one')
        await log2.append('two')
        log2.values[0].sig = replaceAt(log2.values[0].sig, 0, 'X')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }

      const entry = log2.values[0]
      assert.strictEqual(err, `Error: Could not validate signature "${entry.sig}" for entry "${entry.hash}" and key "${entry.key}"`)
      assert.strictEqual(log1.values.length, 1)
      assert.strictEqual(log1.values[0].payload, 'one')
    })

    it('throws an error if entry doesn\'t have append access', async () => {
      const testACL2 = { canAppend: () => false }
      const log1 = new Log(ipfs, testACL, testIdentity, 'A')
      const log2 = new Log(ipfs, testACL2, testIdentity2, 'A')

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }

      assert.strictEqual(err, `Error: Could not append entry, key "${testIdentity2.id}" is not allowed to write to the log`)
    })
  })
})
