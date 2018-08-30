'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const Entry = require('../src/entry')
const { AccessController, IdentityProvider, Keystore } = require('../src/log')
const startIpfs = require('./utils/start-ipfs')

const apis = [require('ipfs')]
const dataDir = './ipfs/tests/entry'

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

let ipfs, testIdentity

apis.forEach((IPFS) => {
  describe('Entry', function () {
    this.timeout(20000)

    const testUserId = 'userA'
    const testKeysPath = './test/fixtures/keys'
    const keystore = Keystore.create(testKeysPath)
    const identitySignerFn = async (id, data) => {
      const key = await keystore.getKey(id)
      return keystore.sign(key, data)
    }
    const testACL = new AccessController()

    before(async () => {
      rmrf.sync(dataDir)
      testIdentity = await IdentityProvider.createIdentity(keystore, testUserId, identitySignerFn)
      ipfs = await startIpfs(IPFS, ipfsConf)
    })

    after(async () => {
      if (ipfs) {
        await ipfs.stop()
      }

      rmrf.sync(dataDir)
    })

    describe('create', () => {
      it('creates a an empty entry', async () => {
        const expectedHash = 'QmVk4R4ePk7PHhpJ9g212iSzgXodw7bKGacMXLkxDavh9X'
        const entry = await Entry.create(ipfs, testIdentity, 'A', 'hello')
        assert.strictEqual(entry.hash, expectedHash)
        assert.strictEqual(entry.id, 'A')
        assert.strictEqual(entry.clock.id, testIdentity.publicKey)
        assert.strictEqual(entry.clock.time, 0)
        assert.strictEqual(entry.v, 0)
        assert.strictEqual(entry.payload, 'hello')
        assert.strictEqual(entry.next.length, 0)
      })

      it('creates a entry with payload', async () => {
        const expectedHash = 'QmfMKCbcAdoT2UGfKxBTJE9TX7PJoHx4YvYZ6kBHeS3QFz'
        const payload = 'hello world'
        const entry = await Entry.create(ipfs, testIdentity, 'A', payload, [])
        assert.strictEqual(entry.payload, payload)
        assert.strictEqual(entry.id, 'A')
        assert.strictEqual(entry.clock.id, testIdentity.publicKey)
        assert.strictEqual(entry.clock.time, 0)
        assert.strictEqual(entry.v, 0)
        assert.strictEqual(entry.next.length, 0)
        assert.strictEqual(entry.hash, expectedHash)
      })

      it('creates a entry with payload and next', async () => {
        const expectedHash = 'QmfYg1oL42CrugMPhat3sCZ6DRwFLTuqzgFLqQy4fNgP1g'
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', payload1, [])
        entry1.clock.tick()
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', payload2, [entry1], entry1.clock)
        assert.strictEqual(entry2.payload, payload2)
        assert.strictEqual(entry2.next.length, 1)
        assert.strictEqual(entry2.hash, expectedHash)
        assert.strictEqual(entry2.clock.id, testIdentity.publicKey)
        assert.strictEqual(entry2.clock.time, 1)
      })

      it('`next` parameter can be an array of strings', async () => {
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', 'hello1', [])
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', 'hello2', [entry1.hash])
        assert.strictEqual(typeof entry2.next[0] === 'string', true)
      })

      it('`next` parameter can be an array of Entry instances', async () => {
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', 'hello1', [])
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', 'hello2', [entry1])
        assert.strictEqual(typeof entry2.next[0] === 'string', true)
      })

      it('`next` parameter can contain nulls and undefined objects', async () => {
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', 'hello1', [])
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', 'hello2', [entry1, null, undefined])
        assert.strictEqual(typeof entry2.next[0] === 'string', true)
      })

      it('throws an error if ipfs is not defined', async () => {
        try {
          await Entry.create() // eslint-disable-line no-unused-
        } catch (e) {
          assert.strictEqual(e.message, 'Ipfs instance not defined')
        }
      })

      it('throws an error if identity are not defined', async () => {
        try {
          await Entry.create(ipfs, null, 'A', 'hello2', [])
        } catch (e) {
          assert.strictEqual(e.message, 'Identity is required, cannot create entry')
        }
      })

      it('throws an error if id is not defined', async () => {
        try {
          await Entry.create(ipfs, testIdentity, null, 'hello', [])
        } catch (e) {
          assert.strictEqual(e.message, 'Entry requires an id')
        }
      })

      it('throws an error if data is not defined', async () => {
        try {
          await Entry.create(ipfs, testIdentity, 'A', null, [])
        } catch (e) {
          assert.strictEqual(e.message, 'Entry requires data')
        }
      })

      it('throws an error if next is not an array', async () => {
        try {
          await Entry.create(ipfs, testIdentity, 'A', 'hello')
        } catch (e) {
          assert.strictEqual(e.message, '\'next\' argument is not an array')
        }
      })
    })

    describe('toMultihash', () => {
      it('returns an ipfs hash', async () => {
        const expectedHash = 'QmVk4R4ePk7PHhpJ9g212iSzgXodw7bKGacMXLkxDavh9X'
        const entry = await Entry.create(ipfs, testIdentity, 'A', 'hello', [])
        const hash = await Entry.toMultihash(ipfs, entry)
        assert.strictEqual(entry.hash, expectedHash)
        assert.strictEqual(hash, expectedHash)
      })

      it('throws an error if ipfs is not defined', async () => {
        try {
          await Entry.toMultihash()
        } catch (e) {
          assert.strictEqual(e.message, 'Ipfs instance not defined')
        }
      })

      it('throws an error if the object being passed is invalid', async () => {
        try {
          await Entry.toMultihash(ipfs, testACL, testIdentity, { hash: 'deadbeef' })
        } catch (e) {
          assert.strictEqual(e.message, 'Invalid object format, cannot generate entry multihash')
        }

        try {
          const entry = await Entry.create(ipfs, testIdentity, 'A', 'hello', [])
          delete entry.clock
          await Entry.toMultihash(ipfs, entry)
        } catch (e) {
          assert.strictEqual(e.message, 'Invalid object format, cannot generate entry multihash')
        }
      })
    })

    describe('fromMultihash', () => {
      it('creates a entry from ipfs hash', async () => {
        const expectedHash = 'Qmb6jCETr8ARcFHS28BFRXJrdyi1eJEpRenqKGDarrhkvT'
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', payload2, [entry1])
        const final = await Entry.fromMultihash(ipfs, entry2.hash)
        assert.strictEqual(final.id, 'A')
        assert.strictEqual(final.payload, payload2)
        assert.strictEqual(final.next.length, 1)
        assert.strictEqual(final.next[0], entry1.hash)
        assert.strictEqual(final.hash, expectedHash)
      })

      it('throws an error if ipfs is not present', async () => {
        try {
          await Entry.fromMultihash()
        } catch (e) {
          assert.strictEqual(e.message, 'Ipfs instance not defined')
        }
      })

      it('throws an error if hash is undefined', async () => {
        try {
          await Entry.fromMultihash(ipfs)
        } catch (e) {
          assert.strictEqual(e.message, 'Invalid hash: undefined')
        }
      })
    })

    describe('isParent', () => {
      it('returns true if entry has a child', async () => {
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', payload2, [entry1])
        assert.strictEqual(Entry.isParent(entry1, entry2), true)
      })

      it('returns false if entry does not have a child', async () => {
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', payload2, [])
        const entry3 = await Entry.create(ipfs, testIdentity, 'A', payload2, [entry2])
        assert.strictEqual(Entry.isParent(entry1, entry2), false)
        assert.strictEqual(Entry.isParent(entry1, entry3), false)
        assert.strictEqual(Entry.isParent(entry2, entry3), true)
      })
    })

    describe('compare', () => {
      it('returns true if entries are the same', async () => {
        const payload1 = 'hello world'
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', payload1, [])
        assert.strictEqual(Entry.isEqual(entry1, entry2), true)
      })

      it('returns true if entries are not the same', async () => {
        const payload1 = 'hello world1'
        const payload2 = 'hello world2'
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', payload2, [])
        assert.strictEqual(Entry.isEqual(entry1, entry2), false)
      })
    })

    describe('isEntry', () => {
      it('is an Entry', async () => {
        const entry = await Entry.create(ipfs, testIdentity, 'A', 'hello', [])
        assert.strictEqual(Entry.isEntry(entry), true)
      })

      it('is not an Entry - no id', async () => {
        const fakeEntry = { next: [], hash: 'Foo', payload: 123, seq: 0 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })

      it('is not an Entry - no seq', async () => {
        const fakeEntry = { next: [], hash: 'Foo', payload: 123 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })

      it('is not an Entry - no next', async () => {
        const fakeEntry = { id: 'A', hash: 'Foo', payload: 123, seq: 0 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })

      it('is not an Entry - no hash', async () => {
        const fakeEntry = { id: 'A', next: [], payload: 123, seq: 0 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })

      it('is not an Entry - no payload', async () => {
        const fakeEntry = { id: 'A', next: [], hash: 'Foo', seq: 0 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })
    })
  })
})
