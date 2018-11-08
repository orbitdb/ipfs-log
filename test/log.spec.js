'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const Keystore = require('orbit-db-keystore')
const Clock = require('../src/lamport-clock')
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

let ipfs, testIdentity, testIdentity2, testIdentity3

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const testACL = new AccessController()
    const keystore = Keystore.create(config.testKeysPath)

    const identitySignerFn = async (id, data) => {
      const key = await keystore.getKey(id)
      return keystore.sign(key, data)
    }
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, {
      repo: config.defaultIpfsConfig.repo + '-log' + new Date().getTime()
    })

    before(async () => {
      rmrf.sync(ipfsConfig.repo)
      testIdentity = await IdentityProvider.createIdentity(keystore, 'userA', { identitySignerFn })
      testIdentity2 = await IdentityProvider.createIdentity(keystore, 'userB', { identitySignerFn })
      testIdentity3 = await IdentityProvider.createIdentity(keystore, 'userC', { identitySignerFn })
      ipfs = await startIpfs(IPFS, ipfsConfig)
    })

    after(async () => {
      await stopIpfs(ipfs)
      rmrf.sync(ipfsConfig.repo)
    })

    describe('constructor', async () => {
      it('creates an empty log with default params', () => {
        const log = new Log(ipfs, testACL, testIdentity)
        assert.notStrictEqual(log._entryIndex, null)
        assert.notStrictEqual(log._headsIndex, null)
        assert.notStrictEqual(log._id, null)
        assert.notStrictEqual(log.id, null)
        assert.notStrictEqual(log.clock, null)
        assert.notStrictEqual(log.values, null)
        assert.notStrictEqual(log.heads, null)
        assert.notStrictEqual(log.tails, null)
        assert.notStrictEqual(log.tailHashes, null)
        assert.deepStrictEqual(log.values, [])
        assert.deepStrictEqual(log.heads, [])
        assert.deepStrictEqual(log.tails, [])
      })

      it('throws an error if IPFS instance is not passed as an argument', () => {
        let err
        try {
          const log = new Log() // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, 'IPFS instance not defined')
      })

      it('sets an id', () => {
        const log = new Log(ipfs, testACL, testIdentity, 'ABC')
        assert.strictEqual(log.id, 'ABC')
      })

      it('sets the clock id', () => {
        const log = new Log(ipfs, testACL, testIdentity, 'ABC')
        assert.strictEqual(log.id, 'ABC')
        assert.strictEqual(log.clock.id, testIdentity.publicKey)
      })

      it('generates id string if id is not passed as an argument', () => {
        const log = new Log(ipfs, testACL, testIdentity)
        assert.strictEqual(typeof log.id === 'string', true)
      })

      it('sets items if given as params', async () => {
        const one = await Entry.create(ipfs, testIdentity, 'A', 'entryA', [], new Clock('A', 0))
        const two = await Entry.create(ipfs, testIdentity, 'A', 'entryB', [], new Clock('B', 0))
        const three = await Entry.create(ipfs, testIdentity, 'A', 'entryC', [], new Clock('C', 0))
        const log = new Log(ipfs, testACL, testIdentity, 'A', [one, two, three])
        assert.strictEqual(log.length, 3)
        assert.strictEqual(log.values[0].payload, 'entryA')
        assert.strictEqual(log.values[1].payload, 'entryB')
        assert.strictEqual(log.values[2].payload, 'entryC')
      })

      it('sets heads if given as params', async () => {
        const one = await Entry.create(ipfs, testIdentity, 'A', 'entryA', [])
        const two = await Entry.create(ipfs, testIdentity, 'A', 'entryB', [])
        const three = await Entry.create(ipfs, testIdentity, 'A', 'entryC', [])
        const log = new Log(ipfs, testACL, testIdentity, 'B', [one, two, three], [three])
        assert.strictEqual(log.heads.length, 1)
        assert.strictEqual(log.heads[0].hash, three.hash)
      })

      it('finds heads if heads not given as params', async () => {
        const one = await Entry.create(ipfs, testIdentity, 'A', 'entryA', [])
        const two = await Entry.create(ipfs, testIdentity, 'A', 'entryB', [])
        const three = await Entry.create(ipfs, testIdentity, 'A', 'entryC', [])
        const log = new Log(ipfs, testACL, testIdentity, 'A', [one, two, three])
        assert.strictEqual(log.heads.length, 3)
        assert.strictEqual(log.heads[0].hash, one.hash)
        assert.strictEqual(log.heads[1].hash, two.hash)
        assert.strictEqual(log.heads[2].hash, three.hash)
      })

      it('throws an error if entries is not an array', () => {
        let err
        try {
          const log = new Log(ipfs, testACL, testIdentity, 'A', {}) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, undefined)
        assert.strictEqual(err.message, `'entries' argument must be an array of Entry instances`)
      })

      it('throws an error if heads is not an array', () => {
        let err
        try {
          const log = new Log(ipfs, testACL, testIdentity, 'A', [], {}) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, undefined)
        assert.strictEqual(err.message, `'heads' argument must be an array`)
      })

      it('throws an error if AccessController is not defined', () => {
        let err
        try {
          const log = new Log(ipfs) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, undefined)
        assert.strictEqual(err.message, 'Access controller is required')
      })

      it('throws an error if identity is not defined', () => {
        let err
        try {
          const log = new Log(ipfs, testACL) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, undefined)
        assert.strictEqual(err.message, 'Identity is required')
      })
    })

    describe('toString', async () => {
      let log
      const expectedData = 'five\n└─four\n  └─three\n    └─two\n      └─one'

      beforeEach(async () => {
        log = new Log(ipfs, testACL, testIdentity, 'A')
        await log.append('one')
        await log.append('two')
        await log.append('three')
        await log.append('four')
        await log.append('five')
      })

      it('returns a nicely formatted string', () => {
        assert.strictEqual(log.toString(), expectedData)
      })
    })

    describe('get', async () => {
      let log

      beforeEach(async () => {
        log = new Log(ipfs, testACL, testIdentity, 'AAA')
        await log.append('one')
      })

      it('returns an Entry', () => {
        const entry = log.get(log.values[0].hash)
        assert.deepStrictEqual(entry.hash, 'QmSaWNF6ef9Y2uHuDbYyBwR3DvKdx8kXq47qZjnoeHNtRs')
      })

      it('returns undefined when Entry is not in the log', () => {
        const entry = log.get('QmFoo')
        assert.deepStrictEqual(entry, undefined)
      })
    })

    describe('has', async () => {
      let log, expectedData

      before(async () => {
        expectedData = {
          hash: 'QmSaWNF6ef9Y2uHuDbYyBwR3DvKdx8kXq47qZjnoeHNtRs',
          id: 'AAA',
          payload: 'one',
          next: [],
          v: 0,
          clock: new Clock(testIdentity.publicKey, 1),
          key: testIdentity.toJSON()
        }
        const sig = testIdentity.provider.sign(testIdentity, Buffer.from(JSON.stringify(expectedData)))
        Object.assign(expectedData, { sig })
      })

      beforeEach(async () => {
        log = new Log(ipfs, testACL, testIdentity, 'AAA')
        await log.append('one')
      })

      it('returns true if it has an Entry', () => {
        assert.strictEqual(log.has(expectedData), true)
      })

      it('returns true if it has an Entry, hash lookup', () => {
        assert.strictEqual(log.has(expectedData.hash), true)
      })

      it('returns false if it doesn\'t have the Entry', () => {
        assert.strictEqual(log.has('QmFoo'), false)
      })
    })

    describe('serialize', async () => {
      let log//, testIdentity2, testIdentity3, testIdentity4
      const expectedData = {
        id: 'AAA',
        heads: ['QmNq7w3wpkzbJJxWJNKcpvQVCPTbKSfXoLV7d9V7SbxaWZ']
      }

      beforeEach(async () => {
        log = new Log(ipfs, testACL, testIdentity, 'AAA')
        await log.append('one')
        await log.append('two')
        await log.append('three')
      })

      describe('toJSON', () => {
        it('returns the log in JSON format', () => {
          assert.strictEqual(JSON.stringify(log.toJSON()), JSON.stringify(expectedData))
        })
      })

      describe('toSnapshot', () => {
        const expectedData = {
          id: 'AAA',
          heads: ['QmNq7w3wpkzbJJxWJNKcpvQVCPTbKSfXoLV7d9V7SbxaWZ'],
          values: [
            'QmSaWNF6ef9Y2uHuDbYyBwR3DvKdx8kXq47qZjnoeHNtRs',
            'QmR3VWNWf2KhEo6QieYeJwWwG3MftsMpZssKTySyeyudik',
            'QmNq7w3wpkzbJJxWJNKcpvQVCPTbKSfXoLV7d9V7SbxaWZ'
          ]
        }

        it('returns the log snapshot', () => {
          const snapshot = log.toSnapshot()
          assert.strictEqual(snapshot.id, expectedData.id)
          assert.strictEqual(snapshot.heads.length, expectedData.heads.length)
          assert.strictEqual(snapshot.heads[0].hash, expectedData.heads[0])
          assert.strictEqual(snapshot.values.length, expectedData.values.length)
          assert.strictEqual(snapshot.values[0].hash, expectedData.values[0])
          assert.strictEqual(snapshot.values[1].hash, expectedData.values[1])
          assert.strictEqual(snapshot.values[2].hash, expectedData.values[2])
        })
      })

      describe('toBuffer', () => {
        it('returns the log as a Buffer', () => {
          assert.deepStrictEqual(log.toBuffer(), Buffer.from(JSON.stringify(expectedData)))
        })
      })

      describe('toMultihash', async () => {
        it('returns the log as ipfs hash', async () => {
          const expectedHash = 'QmWz7YxuGaaqBJBr1SFAtyBWgfZd5pwoDbk8SBh1ijV1Y7'
          let log = new Log(ipfs, testACL, testIdentity, 'A')
          await log.append('one')
          const hash = await log.toMultihash()
          assert.strictEqual(hash, expectedHash)
        })

        it('log serialized to ipfs contains the correct data', async () => {
          const expectedData = {
            id: 'A',
            heads: ['QmeDBciEEFx2DzgznBGHUEegsGDPQDcdX2Z2jQo8AdFD8r']
          }
          const expectedHash = 'QmWz7YxuGaaqBJBr1SFAtyBWgfZd5pwoDbk8SBh1ijV1Y7'
          let log = new Log(ipfs, testACL, testIdentity, 'A')
          await log.append('one')
          const hash = await log.toMultihash()
          assert.strictEqual(hash, expectedHash)
          const result = await ipfs.object.get(hash)
          const res = JSON.parse(result.toJSON().data.toString())
          assert.deepStrictEqual(res.heads, expectedData.heads)
        })

        it('throws an error if log items is empty', async () => {
          const emptyLog = new Log(ipfs, testACL, testIdentity)
          let err
          try {
            await emptyLog.toMultihash()
          } catch (e) {
            err = e
          }
          assert.notStrictEqual(err, null)
          assert.strictEqual(err.message, 'Can\'t serialize an empty log')
        })
      })

      describe('fromMultihash', async () => {
        it('creates a log from ipfs hash - one entry', async () => {
          const expectedData = {
            id: 'X',
            heads: ['QmeBpPVreW2zTh2vxbTYxVtoscBE5tYvFq3nRP8mbtBS8L']
          }
          let log = new Log(ipfs, testACL, testIdentity, 'X')
          await log.append('one')
          const hash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, -1)
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
          assert.strictEqual(res.length, 1)
          assert.strictEqual(res.values[0].payload, 'one')
          assert.strictEqual(res.values[0].clock.id, testIdentity.publicKey)
          assert.strictEqual(res.values[0].clock.time, 1)
        })

        it('creates a log from ipfs hash - three entries', async () => {
          const hash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, -1)
          assert.strictEqual(res.length, 3)
          assert.strictEqual(res.values[0].payload, 'one')
          assert.strictEqual(res.values[0].clock.time, 1)
          assert.strictEqual(res.values[1].payload, 'two')
          assert.strictEqual(res.values[1].clock.time, 2)
          assert.strictEqual(res.values[2].payload, 'three')
          assert.strictEqual(res.values[2].clock.time, 3)
        })

        it('has the right sequence number after creation and appending', async () => {
          const hash = await log.toMultihash()
          let res = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, -1)
          assert.strictEqual(res.length, 3)
          await res.append('four')
          assert.strictEqual(res.length, 4)
          assert.strictEqual(res.values[3].payload, 'four')
          assert.strictEqual(res.values[3].clock.time, 4)
        })

        it('creates a log from ipfs hash that has three heads', async () => {
          let log1 = new Log(ipfs, testACL, testIdentity, 'A')
          let log2 = new Log(ipfs, testACL, testIdentity2, 'B')
          let log3 = new Log(ipfs, testACL, testIdentity3, 'C')
          await log1.append('one') // order is determined by the identity's publicKey
          await log3.append('two')
          await log2.append('three')
          await log1.join(log2)
          await log1.join(log3)
          const hash = await log1.toMultihash()
          const res = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, -1)
          assert.strictEqual(res.length, 3)
          assert.strictEqual(res.heads.length, 3)
          assert.strictEqual(res.heads[0].payload, 'one')
          assert.strictEqual(res.heads[1].payload, 'two') // order is determined by the identity's publicKey
          assert.strictEqual(res.heads[2].payload, 'three')
        })

        it('creates a log from ipfs hash up to a size limit', async () => {
          const amount = 100
          const size = amount / 2
          let log = new Log(ipfs, testACL, testIdentity, 'A')
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }
          const hash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, size)
          assert.strictEqual(res.length, size)
        })

        it('creates a log from ipfs hash up without size limit', async () => {
          const amount = 100
          let log = new Log(ipfs, testACL, testIdentity, 'A')
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }
          const hash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, -1)
          assert.strictEqual(res.length, amount)
        })

        it('throws an error if ipfs is not defined', async () => {
          let err
          try {
            await Log.fromMultihash()
          } catch (e) {
            err = e
          }
          assert.notStrictEqual(err, null)
          assert.strictEqual(err.message, 'IPFS instance not defined')
        })

        it('throws an error if hash is not defined', async () => {
          let err
          try {
            await Log.fromMultihash(ipfs)
          } catch (e) {
            err = e
          }
          assert.notStrictEqual(err, null)
          assert.strictEqual(err.message, 'Invalid hash: undefined')
        })

        it('throws an error when data from hash is not instance of Log', async () => {
          const res = await ipfs.object.put(Buffer.from('{}'))
          let err
          try {
            await Log.fromMultihash(ipfs, testACL, testIdentity, res.toJSON().multihash)
          } catch (e) {
            err = e
          }
          assert.strictEqual(err.message, 'Given argument is not an instance of Log')
        })

        it('throws an error if data from hash is not valid JSON', async () => {
          const res = await ipfs.object.put(Buffer.from('hello'))
          let err
          try {
            await Log.fromMultihash(ipfs, testACL, testIdentity, res.toJSON().multihash)
          } catch (e) {
            err = e
          }
          assert.strictEqual(err.message, 'Unexpected token h in JSON at position 0')
        })

        it('onProgress callback is fired for each entry', async () => {
          const amount = 100
          let log = new Log(ipfs, testACL, testIdentity, 'A')
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }

          const items = log.values
          let i = 0
          const loadProgressCallback = (hash, entry, depth) => {
            assert.notStrictEqual(entry, null)
            assert.strictEqual(hash, items[items.length - i - 1].hash)
            assert.strictEqual(entry.hash, items[items.length - i - 1].hash)
            assert.strictEqual(entry.payload, items[items.length - i - 1].payload)
            assert.strictEqual(depth - 1, i)
            i++
          }

          const hash = await log.toMultihash()
          const result = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, -1, [], loadProgressCallback)

          // Make sure the onProgress callback was called for each entry
          assert.strictEqual(i, amount)
          // Make sure the log entries are correct ones
          assert.strictEqual(result.values[0].clock.time, 1)
          assert.strictEqual(result.values[0].payload, '0')
          assert.strictEqual(result.values[result.length - 1].clock.time, 100)
          assert.strictEqual(result.values[result.length - 1].payload, '99')
        })
      })
    })

    describe('values', () => {
      it('returns all entries in the log', async () => {
        let log = new Log(ipfs, testACL, testIdentity)
        assert.strictEqual(log.values instanceof Array, true)
        assert.strictEqual(log.length, 0)
        await log.append('hello1')
        await log.append('hello2')
        await log.append('hello3')
        assert.strictEqual(log.values instanceof Array, true)
        assert.strictEqual(log.length, 3)
        assert.strictEqual(log.values[0].payload, 'hello1')
        assert.strictEqual(log.values[1].payload, 'hello2')
        assert.strictEqual(log.values[2].payload, 'hello3')
      })
    })
  })
})
