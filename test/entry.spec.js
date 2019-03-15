'use strict'

const assert = require('assert')
const sinon = require('sinon')
const rmrf = require('rimraf')
const Entry = require('../src/entry')
const Log = require('../src/log')
const { io } = require('../src/utils')
const AccessController = Log.AccessController
const IdentityProvider = require('orbit-db-identity-provider')
const v0Entries = require('./fixtures/v0-entries.fixture')

// Test utils
const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('./utils')

let ipfs, testIdentity

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Entry (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const testACL = new AccessController()
    const { identityKeysPath, signingKeysPath } = config
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, {
      repo: config.defaultIpfsConfig.repo + '-entry' + new Date().getTime()
    })

    before(async () => {
      rmrf.sync(ipfsConfig.repo)
      testIdentity = await IdentityProvider.createIdentity({ id: 'userA', identityKeysPath, signingKeysPath })
      ipfs = await startIpfs(IPFS, ipfsConfig)
    })

    after(async () => {
      await stopIpfs(ipfs)
      rmrf.sync(ipfsConfig.repo)
    })

    describe('create', () => {
      it('creates a an empty entry', async () => {
        const expectedCid = 'zdpuAnVZkmiNbtgwCguuphDe2qojCGN4EztkSGNyiJxwizudY'
        const entry = await Entry.create(ipfs, testIdentity, 'A', 'hello')
        assert.strictEqual(entry.cid, expectedCid)
        assert.strictEqual(entry.id, 'A')
        assert.strictEqual(entry.clock.id, testIdentity.publicKey)
        assert.strictEqual(entry.clock.time, 0)
        assert.strictEqual(entry.v, 1)
        assert.strictEqual(entry.payload, 'hello')
        assert.strictEqual(entry.next.length, 0)
      })

      it('creates a entry with payload', async () => {
        const expectedCid = 'zdpuAwxcFXg67SFPvm3rpDV7WKz7oBeZ6wGfisMycCUVxWnFk'
        const payload = 'hello world'
        const entry = await Entry.create(ipfs, testIdentity, 'A', payload, [])
        assert.strictEqual(entry.payload, payload)
        assert.strictEqual(entry.id, 'A')
        assert.strictEqual(entry.clock.id, testIdentity.publicKey)
        assert.strictEqual(entry.clock.time, 0)
        assert.strictEqual(entry.v, 1)
        assert.strictEqual(entry.next.length, 0)
        assert.strictEqual(entry.cid, expectedCid)
      })

      it('creates a entry with payload and next', async () => {
        const expectedCid = 'zdpuAmTCUPk1qDWH6zYiScRPUGt7wpaoq2jRXm1j7bd5sdUu6'
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', payload1, [])
        entry1.clock.tick()
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', payload2, [entry1], entry1.clock)
        assert.strictEqual(entry2.payload, payload2)
        assert.strictEqual(entry2.next.length, 1)
        assert.strictEqual(entry2.cid, expectedCid)
        assert.strictEqual(entry2.clock.id, testIdentity.publicKey)
        assert.strictEqual(entry2.clock.time, 1)
      })

      it('should return an entry interopable with older versions', async () => {
        const expectedCid = 'zdpuAnVZkmiNbtgwCguuphDe2qojCGN4EztkSGNyiJxwizudY'
        const entry = await Entry.create(ipfs, testIdentity, 'A', 'hello')
        assert.strictEqual(entry.cid, entry.hash)
        assert.strictEqual(entry.cid, expectedCid)
      })

      it('`next` parameter can be an array of strings', async () => {
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', 'hello1', [])
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', 'hello2', [entry1.cid])
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
        let err
        try {
          await Entry.create()
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if identity are not defined', async () => {
        let err
        try {
          await Entry.create(ipfs, null, 'A', 'hello2', [])
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, 'Identity is required, cannot create entry')
      })

      it('throws an error if id is not defined', async () => {
        let err
        try {
          await Entry.create(ipfs, testIdentity, null, 'hello', [])
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, 'Entry requires an id')
      })

      it('throws an error if data is not defined', async () => {
        let err
        try {
          await Entry.create(ipfs, testIdentity, 'A', null, [])
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, 'Entry requires data')
      })

      it('throws an error if next is not an array', async () => {
        let err
        try {
          await Entry.create(ipfs, testIdentity, 'A', 'hello', {})
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, '\'next\' argument is not an array')
      })
    })

    describe('toCID', () => {
      it('returns an ipfs CID', async () => {
        const expectedCid = 'zdpuAnVZkmiNbtgwCguuphDe2qojCGN4EztkSGNyiJxwizudY'
        const entry = await Entry.create(ipfs, testIdentity, 'A', 'hello', [])
        const cid = await Entry.toCID(ipfs, entry)
        assert.strictEqual(entry.cid, expectedCid)
        assert.strictEqual(cid, expectedCid)
      })

      it('returns the correct ipfs CID (multihash) for a v0 entry', async () => {
        const expectedMultihash = 'QmV5NpvViHHouBfo7CSnfX2iB4t5PVWNJG8doKt5cwwnxY'
        const entry = v0Entries.hello
        const multihash = await Entry.toMultihash(ipfs, entry)
        assert.strictEqual(multihash, expectedMultihash)
      })

      it('throws an error if ipfs is not defined', async () => {
        let err
        try {
          await Entry.toCID()
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if the object being passed is invalid', async () => {
        let err1, err2
        try {
          await Entry.toCID(ipfs, testACL, testIdentity, { cid: 'deadbeef' })
        } catch (e) {
          err1 = e
        }

        assert.strictEqual(err1.message, 'Invalid object format, cannot generate entry CID')

        try {
          const entry = await Entry.create(ipfs, testIdentity, 'A', 'hello', [])
          delete entry.clock
          await Entry.toCID(ipfs, entry)
        } catch (e) {
          err2 = e
        }
        assert.strictEqual(err2.message, 'Invalid object format, cannot generate entry CID')
      })
    })

    describe('toMultihash', () => {
      it('returns an ipfs multihash', async () => {
        const expectedMultihash = 'QmW2b1VncVEHNNjNEanKEznqDmY5nDBkQangWj6B3FBj3U'
        const entry = await Entry.create(ipfs, testIdentity, 'A', 'hello', [])
        const multihash = await Entry.toMultihash(ipfs, entry)
        assert.strictEqual(multihash, expectedMultihash)
      })

      it('returns the correct ipfs multihash for a v0 entry', async () => {
        const expectedMultihash = 'QmV5NpvViHHouBfo7CSnfX2iB4t5PVWNJG8doKt5cwwnxY'
        const entry = v0Entries.hello
        const multihash = await Entry.toMultihash(ipfs, entry)
        assert.strictEqual(multihash, expectedMultihash)
      })

      it('throws an error if ipfs is not defined', async () => {
        let err
        try {
          await Entry.toMultihash()
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if the object being passed is invalid', async () => {
        let err1, err2
        try {
          await Entry.toMultihash(ipfs, testACL, testIdentity, { cid: 'deadbeef' })
        } catch (e) {
          err1 = e
        }

        assert.strictEqual(err1.message, 'Invalid object format, cannot generate entry CID')

        try {
          const entry = await Entry.create(ipfs, testIdentity, 'A', 'hello', [])
          delete entry.clock
          await Entry.toMultihash(ipfs, entry)
        } catch (e) {
          err2 = e
        }
        assert.strictEqual(err2.message, 'Invalid object format, cannot generate entry CID')
      })
    })

    describe('fromCID', () => {
      it('creates a entry from ipfs CID', async () => {
        const expectedCid = 'zdpuAqFSTCgEMky7YfyHUFGxuwHjpM5AjKG9JFTyXiYQqRPmP'
        const payload1 = 'hello world'
        const payload2 = 'hello again'
        const entry1 = await Entry.create(ipfs, testIdentity, 'A', payload1, [])
        const entry2 = await Entry.create(ipfs, testIdentity, 'A', payload2, [entry1])
        const final = await Entry.fromCID(ipfs, entry2.cid)

        assert.deepStrictEqual(entry2, final)
        assert.strictEqual(final.id, 'A')
        assert.strictEqual(final.payload, payload2)
        assert.strictEqual(final.next.length, 1)
        assert.strictEqual(final.next[0], entry1.cid)
        assert.strictEqual(final.cid, expectedCid)
      })

      it('creates a entry from ipfs multihash of v0 entries', async () => {
        const expectedCid = 'QmTLLKuNVXC95rGcnrL1M3xKf4dWYuu3MeAM3LUh3YNDJ7'
        const entry1Cid = await io.write(ipfs, 'dag-pb', v0Entries.helloWorld)
        const entry2Cid = await io.write(ipfs, 'dag-pb', v0Entries.helloAgain)
        const final = await Entry.fromCID(ipfs, entry2Cid)

        assert.strictEqual(final.id, 'A')
        assert.strictEqual(final.payload, v0Entries.helloAgain.payload)
        assert.strictEqual(final.next.length, 1)
        assert.strictEqual(final.next[0], v0Entries.helloAgain.next[0])
        assert.strictEqual(final.next[0], entry1Cid)
        assert.strictEqual(final.v, 0)
        assert.strictEqual(final.cid, entry2Cid)
        assert.strictEqual(final.cid, expectedCid)
      })

      it('should return an entry interopable with older and newer versions', async () => {
        const expectedCidV1 = 'zdpuAnVZkmiNbtgwCguuphDe2qojCGN4EztkSGNyiJxwizudY'
        const entryV1 = await Entry.create(ipfs, testIdentity, 'A', 'hello', [])
        const finalV1 = await Entry.fromCID(ipfs, entryV1.cid)
        assert.strictEqual(finalV1.cid, finalV1.hash)
        assert.strictEqual(finalV1.cid, expectedCidV1)
        assert.strictEqual(Object.assign({}, finalV1).cid, expectedCidV1)
        assert.strictEqual(Object.assign({}, finalV1).hash, undefined)

        const expectedCidV0 = 'QmderYccue9XqB7V4EYf71ZygWELdzdbVqo1oxR4nMRrCh'
        const entryCidV0 = await io.write(ipfs, 'dag-pb', v0Entries.helloWorld)
        const finalV0 = await Entry.fromCID(ipfs, entryCidV0)
        assert.strictEqual(finalV0.cid, finalV0.hash)
        assert.strictEqual(finalV0.cid, expectedCidV0)
        assert.strictEqual(Object.assign({}, finalV0).cid, undefined)
        assert.strictEqual(Object.assign({}, finalV0).hash, expectedCidV0)
      })

      it('throws an error if ipfs is not present', async () => {
        let err
        try {
          await Entry.fromCID()
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if CID is undefined', async () => {
        let err
        try {
          await Entry.fromCID(ipfs)
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, 'Invalid CID: undefined')
      })
    })

    describe('fromMultihash', () => {
      afterEach(() => {
        if (Entry.fromCID.restore) {
          Entry.fromCID.restore()
        }
      })

      it('call fromCID', async () => {
        const spy = sinon.spy(Entry, 'fromCID')

        const expectedCid = 'QmTLLKuNVXC95rGcnrL1M3xKf4dWYuu3MeAM3LUh3YNDJ7'
        await io.write(ipfs, 'dag-pb', v0Entries.helloWorld)
        const entry2Cid = await io.write(ipfs, 'dag-pb', v0Entries.helloAgain)
        const final = await Entry.fromCID(ipfs, entry2Cid)

        assert(spy.calledOnceWith(ipfs, entry2Cid))
        assert.strictEqual(final.cid, expectedCid)
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

      it('is an Entry (v0)', async () => {
        assert.strictEqual(Entry.isEntry(v0Entries.hello), true)
      })

      it('is not an Entry - no id', async () => {
        const fakeEntry = { next: [], v: 1, cid: 'Foo', payload: 123, seq: 0 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })

      it('is not an Entry - no seq', async () => {
        const fakeEntry = { next: [], v: 1, cid: 'Foo', payload: 123 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })

      it('is not an Entry - no next', async () => {
        const fakeEntry = { id: 'A', v: 1, cid: 'Foo', payload: 123, seq: 0 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })

      it('is not an Entry - no version', async () => {
        const fakeEntry = { id: 'A', next: [], payload: 123, seq: 0 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })

      it('is not an Entry - no cid', async () => {
        const fakeEntry = { id: 'A', v: 1, next: [], payload: 123, seq: 0 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })

      it('is not an Entry - no payload', async () => {
        const fakeEntry = { id: 'A', v: 1, next: [], cid: 'Foo', seq: 0 }
        assert.strictEqual(Entry.isEntry(fakeEntry), false)
      })
    })
  })
})
