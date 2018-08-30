'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const LogCreator = require('./utils/log-creator')
const bigLogString = require('./fixtures/big-log.fixture.js')
const Log = require('../src/log')
const Entry = require('../src/entry')
const Clock = require('../src/lamport-clock')
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

let ipfs, testIdentity, testIdentity2, testIdentity3, testIdentity4

const last = (arr) => {
  return arr[arr.length - 1]
}

apis.forEach((IPFS) => {
  const testKeysPath = './test/fixtures/keys'
  const keystore = Keystore.create(testKeysPath)
  const identitySignerFn = async (id, data) => {
    const key = await keystore.getKey(id)
    return keystore.sign(key, data)
  }
  const testACL = new AccessController()

  describe('Log', function () {
    this.timeout(20000)

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

      it('throws an error if ImmutableDB instance is not passed as an argument', () => {
        try {
          const log = new Log() // eslint-disable-line no-unused-vars
        } catch (err) {
          assert.strictEqual(err.message, 'ImmutableDB instance not defined')
        }
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
        try {
          const log = new Log(ipfs, testACL, testIdentity, 'A', {}) // eslint-disable-line no-unused-vars
        } catch (err) {
          assert.notStrictEqual(err, undefined)
          assert.strictEqual(err.message, `'entries' argument must be an array of Entry instances`)
        }
      })

      it('throws an error if heads is not an array', () => {
        try {
          const log = new Log(ipfs, testACL, testIdentity, 'A', [], {}) // eslint-disable-line no-unused-vars
        } catch (err) {
          assert.notStrictEqual(err, undefined)
          assert.strictEqual(err.message, `'heads' argument must be an array`)
        }
      })

      it('throws an error if ACL and Identity are not defined', () => {
        try {
          const log = new Log(ipfs) // eslint-disable-line no-unused-vars
        } catch (err) {
          assert.notStrictEqual(err, undefined)
          assert.strictEqual(err.message, 'Access controller is required')
        }

        try {
          const log = new Log(ipfs, testACL) // eslint-disable-line no-unused-vars
        } catch (err) {
          assert.notStrictEqual(err, undefined)
          assert.strictEqual(err.message, 'Identity is required')
        }
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
        assert.deepStrictEqual(entry.hash, 'QmVRpSH5Tq9zX7HNUHaVsuct69CihanpAptqF9dRmybTcJ')
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
          hash: 'QmVRpSH5Tq9zX7HNUHaVsuct69CihanpAptqF9dRmybTcJ',
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
        heads: ['QmPtC2HyWQFgP9zAsuomcC7viJhQLXwoBuk72f1hQoGqgQ']
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
          heads: ['QmPtC2HyWQFgP9zAsuomcC7viJhQLXwoBuk72f1hQoGqgQ'],
          values: [
            'QmVRpSH5Tq9zX7HNUHaVsuct69CihanpAptqF9dRmybTcJ',
            'QmVuKMqjch4m6joYMqEM2Qr7WKkFY9jZ3SvQZu3jcSRqck',
            'QmPtC2HyWQFgP9zAsuomcC7viJhQLXwoBuk72f1hQoGqgQ'
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
          const expectedHash = 'QmTkwV5BwuEpQNV2TLpvfsodqvkdqqXMWuNkaaAgFTYxkB'
          let log = new Log(ipfs, testACL, testIdentity, 'A')
          await log.append('one')
          const hash = await log.toMultihash()
          assert.strictEqual(hash, expectedHash)
        })

        it('log serialized to ipfs contains the correct data', async () => {
          const expectedData = {
            id: 'A',
            heads: ['QmYaoNpasjTXyEdnBezvFCyjuynAygzqveURK95MTCdbwh']
          }
          const expectedHash = 'QmTkwV5BwuEpQNV2TLpvfsodqvkdqqXMWuNkaaAgFTYxkB'
          let log = new Log(ipfs, testACL, testIdentity, 'A')
          await log.append('one')
          const hash = await log.toMultihash()
          assert.strictEqual(hash, expectedHash)
          // const result = await ipfs.get(hash)
          const result = await ipfs.object.get(hash)
          const res = JSON.parse(result.toJSON().data.toString())
          assert.deepStrictEqual(res.heads, expectedData.heads)
        })

        it('throws an error if log items is empty', () => {
          const emptyLog = new Log(ipfs, testACL, testIdentity)
          let err
          try {
            emptyLog.toMultihash()
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
            heads: ['Qmdw8hTMzVnG4VTYRN61VPcomrDGw244co26Jid7j4WDJ7']
          }
          let log = new Log(ipfs, testACL, testIdentity, 'X')
          await log.append('one')
          const hash = await log.toMultihash()
          // fromMultihash length = -1
          const res = await Log.fromMultihash(ipfs, testACL, testIdentity, hash, -1)
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
          assert.strictEqual(res.length, 1)
          assert.strictEqual(res.values[0].payload, 'one')
          assert.strictEqual(res.values[0].clock.id, testIdentity.publicKey)
          assert.strictEqual(res.values[0].clock.time, 1)
        })

        it('creates a log from ipfs hash - three entries', async () => {
          const hash = await log.toMultihash()
          // fromMultihash length = -1
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
          // fromMultihash length = -1
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
          // fromMultihash length = -1
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

        it('throws an error if ipfs is not defined', () => {
          try {
            const log = Log.fromMultihash() // eslint-disable-line no-unused-vars
          } catch (err) {
            assert.notStrictEqual(err, null)
            assert.strictEqual(err.message, 'ImmutableDB instance not defined')
          }
        })

        it('throws an error if hash is not defined', () => {
          try {
            const log = Log.fromMultihash(ipfs) // eslint-disable-line no-unused-vars
          } catch (err) {
            assert.notStrictEqual(err, null)
            assert.strictEqual(err.message, 'Invalid hash: undefined')
          }
        })

        it('throws an error when data from hash is not instance of Log', async () => {
          const res = await ipfs.object.put(Buffer.from('{}'))
          try {
            await Log.fromMultihash(ipfs, testACL, testIdentity, res.toJSON().multihash)
          } catch (err) {
            assert.strictEqual(err.message, 'Given argument is not an instance of Log')
          }
        })

        it('throws an error if data from hash is not valid JSON', async () => {
          const res = await ipfs.object.put(Buffer.from('hello'))
          try {
            await Log.fromMultihash(ipfs, testACL, testIdentity, res.toJSON().multihash)
          } catch (err) {
            assert.strictEqual(err.message, 'Unexpected token h in JSON at position 0')
          }
        })

        it('onProgress callback is fired for each entry', async () => {
          const amount = 100
          let log = new Log(ipfs, testACL, testIdentity, 'A')
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }

          const items = log.values
          let i = 0
          const callback = (hash, entry, depth) => {
            assert.notStrictEqual(entry, null)
            assert.strictEqual(hash, items[items.length - i - 1].hash)
            assert.strictEqual(entry.hash, items[items.length - i - 1].hash)
            assert.strictEqual(entry.payload, items[items.length - i - 1].payload)
            assert.strictEqual(depth - 1, i)
            i++
          }

          try {
            const hash = await log.toMultihash()
            await Log.fromMultihash(ipfs, testACL, testIdentity, hash, -1, [], callback)
          } catch (e) {
            throw e
          }
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

    describe('append', () => {
      describe('append one', async () => {
        let log

        before(async () => {
          log = new Log(ipfs, testACL, testIdentity, 'A')
          await log.append('hello1')
        })

        it('added the correct amount of items', () => {
          assert.strictEqual(log.length, 1)
        })

        it('added the correct values', async () => {
          log.values.forEach((entry) => {
            assert.strictEqual(entry.payload, 'hello1')
          })
        })

        it('added the correct amount of next pointers', async () => {
          log.values.forEach((entry) => {
            assert.strictEqual(entry.next.length, 0)
          })
        })

        it('has the correct heads', async () => {
          log.heads.forEach((head) => {
            assert.strictEqual(head.hash, log.values[0].hash)
          })
        })

        it('updated the clocks correctly', async () => {
          log.values.forEach((entry) => {
            assert.strictEqual(entry.clock.id, testIdentity.publicKey)
            assert.strictEqual(entry.clock.time, 1)
          })
        })
      })

      describe('append 100 items to a log', async () => {
        const amount = 100
        const nextPointerAmount = 64

        let log

        before(async () => {
          log = new Log(ipfs, testACL, testIdentity, 'A')
          for (let i = 0; i < amount; i++) {
            await log.append('hello' + i, nextPointerAmount)
            // Make sure the log has the right heads after each append
            const values = log.values
            assert.strictEqual(log.heads.length, 1)
            assert.strictEqual(log.heads[0].hash, values[values.length - 1].hash)
          }
        })

        it('added the correct amount of items', () => {
          assert.strictEqual(log.length, amount)
        })

        it('added the correct values', async () => {
          log.values.forEach((entry, index) => {
            assert.strictEqual(entry.payload, 'hello' + index)
          })
        })

        it('updated the clocks correctly', async () => {
          log.values.forEach((entry, index) => {
            assert.strictEqual(entry.clock.time, index + 1)
            assert.strictEqual(entry.clock.id, testIdentity.publicKey)
          })
        })

        it('added the correct amount of next pointers', async () => {
          log.values.forEach((entry, index) => {
            assert.strictEqual(entry.next.length, Math.min(index, nextPointerAmount))
          })
        })
      })
    })

    describe('join', () => {
      let log1, log2, log3, log4

      beforeEach(async () => {
        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        log3 = new Log(ipfs, testACL, testIdentity3, 'X')
        log4 = new Log(ipfs, testACL, testIdentity4, 'X')
      })

      it('joins logs', async () => {
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for (let i = 1; i <= amount; i++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await Entry.create(ipfs, testIdentity, 'X', 'entryA' + i, [prev1])
          const n2 = await Entry.create(ipfs, testIdentity2, 'X', 'entryB' + i, [prev2, n1])
          const n3 = await Entry.create(ipfs, testIdentity3, 'X', 'entryC' + i, [prev3, n1, n2])
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        // Here we're creating a log from entries signed by A and B
        // but we accept entries from C too
        const logA = await Log.fromEntry(ipfs, testACL, testIdentity3, last(items2), -1)
        // Here we're creating a log from entries signed by peer A, B and C
        // "logA" accepts entries from peer C so we can join logs A and B
        const logB = await Log.fromEntry(ipfs, testACL, testIdentity3, last(items3), -1)
        assert.strictEqual(logA.length, items2.length + items1.length)
        assert.strictEqual(logB.length, items3.length + items2.length + items1.length)

        try {
          await logA.join(logB)
        } catch (e) {
          console.error(e)
        }
        assert.strictEqual(logA.length, items3.length + items2.length + items1.length)
        // The last entry, 'entryC100', should be the only head
        // (it points to entryB100, entryB100 and entryC99)
        assert.strictEqual(logA.heads.length, 1)
      })

      it('throws an error if first log is not defined', async () => {
        let err
        try {
          await log1.join()
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, null)
        assert.strictEqual(err.message, 'Log instance not defined')
      })

      it('throws an error if passed argument is not an instance of Log', async () => {
        let err
        try {
          await log1.join({})
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, null)
        assert.strictEqual(err.message, 'Given argument is not an instance of Log')
      })

      it('joins only unique items', async () => {
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        await log1.join(log2)

        const expectedData = [
          'helloA1', 'helloB1', 'helloA2', 'helloB2'
        ]

        assert.strictEqual(log1.length, 4)
        assert.deepStrictEqual(log1.values.map((e) => e.payload), expectedData)

        const item = last(log1.values)
        assert.strictEqual(item.next.length, 1)
      })

      it('joins logs two ways', async () => {
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        await log2.join(log1)

        const expectedData = [
          'helloA1', 'helloB1', 'helloA2', 'helloB2'
        ]

        assert.deepStrictEqual(log1.values.map((e) => e.hash), log2.values.map((e) => e.hash))
        assert.deepStrictEqual(log1.values.map((e) => e.payload), expectedData)
        assert.deepStrictEqual(log2.values.map((e) => e.payload), expectedData)
      })

      it('joins logs twice', async () => {
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log2.join(log1)

        await log1.append('helloA2')
        await log2.append('helloB2')
        await log2.join(log1)

        const expectedData = [
          'helloA1', 'helloB1', 'helloA2', 'helloB2'
        ]

        assert.strictEqual(log2.length, 4)
        assert.deepStrictEqual(log2.values.map((e) => e.payload), expectedData)
      })

      it('joins 2 logs two ways', async () => {
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log2.join(log1) // Make sure we keep the original log id
        await log1.join(log2)

        await log1.append('helloA2')
        await log2.append('helloB2')
        await log2.join(log1)

        const expectedData = [
          'helloA1', 'helloB1', 'helloA2', 'helloB2'
        ]

        assert.strictEqual(log2.length, 4)
        assert.deepStrictEqual(log2.values.map((e) => e.payload), expectedData)
      })

      it('joins 4 logs to one', async () => {
        // order determined by identity's publicKey
        await log1.append('helloA1')
        await log1.append('helloA2')

        await log3.append('helloB1')
        await log3.append('helloB2')

        await log4.append('helloC1')
        await log4.append('helloC2')

        await log2.append('helloD1')
        await log2.append('helloD2')
        await log1.join(log2)
        await log1.join(log3)
        await log1.join(log4)

        const expectedData = [
          'helloA1',
          'helloB1',
          'helloC1',
          'helloD1',
          'helloA2',
          'helloB2',
          'helloC2',
          'helloD2'
        ]

        assert.strictEqual(log1.length, 8)
        assert.deepStrictEqual(log1.values.map(e => e.payload), expectedData)
      })

      it('joins 4 logs to one is commutative', async () => {
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log4.append('helloD1')
        await log4.append('helloD2')
        await log1.join(log2)
        await log1.join(log3)
        await log1.join(log4)
        await log2.join(log1)
        await log2.join(log3)
        await log2.join(log4)

        assert.strictEqual(log1.length, 8)
        assert.deepStrictEqual(log1.values.map(e => e.payload), log2.values.map(e => e.payload))
      })

      it('joins logs and updates clocks', async () => {
        await log1.append('helloA1')
        await log2.append('helloB1')
        await log2.join(log1)
        await log1.append('helloA2')
        await log2.append('helloB2')

        assert.strictEqual(log1.clock.id, testIdentity.publicKey)
        assert.strictEqual(log2.clock.id, testIdentity2.publicKey)
        assert.strictEqual(log1.clock.time, 2)
        assert.strictEqual(log2.clock.time, 2)

        await log3.join(log1)
        assert.strictEqual(log3.id, 'X')
        assert.strictEqual(log3.clock.id, testIdentity3.publicKey)
        assert.strictEqual(log3.clock.time, 2)

        await log3.append('helloC1')
        await log3.append('helloC2')
        await log1.join(log3)
        await log1.join(log2)
        await log4.append('helloD1')
        await log4.append('helloD2')
        await log4.join(log2)
        await log4.join(log1)
        await log4.join(log3)
        await log4.append('helloD3')
        await log4.append('helloD4')

        await log1.join(log4)
        await log4.join(log1)
        await log4.append('helloD5')
        await log1.append('helloA5')
        await log4.join(log1)
        assert.deepStrictEqual(log4.clock.id, testIdentity4.publicKey)
        assert.deepStrictEqual(log4.clock.time, 7)

        await log4.append('helloD6')
        assert.deepStrictEqual(log4.clock.time, 8)

        const expectedData = [
          { payload: 'helloA1', id: 'X', clock: new Clock(testIdentity.publicKey, 1) },
          { payload: 'helloD1', id: 'X', clock: new Clock(testIdentity4.publicKey, 1) },
          { payload: 'helloB1', id: 'X', clock: new Clock(testIdentity2.publicKey, 1) },
          { payload: 'helloA2', id: 'X', clock: new Clock(testIdentity.publicKey, 2) },
          { payload: 'helloD2', id: 'X', clock: new Clock(testIdentity4.publicKey, 2) },
          { payload: 'helloB2', id: 'X', clock: new Clock(testIdentity2.publicKey, 2) },
          { payload: 'helloC1', id: 'X', clock: new Clock(testIdentity3.publicKey, 3) },
          { payload: 'helloC2', id: 'X', clock: new Clock(testIdentity3.publicKey, 4) },
          { payload: 'helloD3', id: 'X', clock: new Clock(testIdentity4.publicKey, 5) },
          { payload: 'helloD4', id: 'X', clock: new Clock(testIdentity4.publicKey, 6) },
          { payload: 'helloA5', id: 'X', clock: new Clock(testIdentity.publicKey, 7) },
          { payload: 'helloD5', id: 'X', clock: new Clock(testIdentity4.publicKey, 7) },
          { payload: 'helloD6', id: 'X', clock: new Clock(testIdentity4.publicKey, 8) }
        ]

        const transformed = log4.values.map((e) => {
          return { payload: e.payload, id: e.id, clock: e.clock }
        })

        assert.strictEqual(log4.length, 13)
        assert.deepStrictEqual(transformed, expectedData)
      })

      it('joins logs from 4 logs', async () => {
        await log1.append('helloA1')
        await log1.join(log2)
        await log2.append('helloB1')
        await log2.join(log1)
        await log1.append('helloA2')
        await log2.append('helloB2')

        await log1.join(log3)
        assert.strictEqual(log1.id, 'X')
        assert.strictEqual(log1.clock.id, testIdentity.publicKey)
        assert.strictEqual(log1.clock.time, 2)

        await log3.join(log1)
        assert.strictEqual(log3.id, 'X')
        assert.strictEqual(log3.clock.id, testIdentity3.publicKey)
        assert.strictEqual(log3.clock.time, 2)

        await log3.append('helloC1')
        await log3.append('helloC2')
        await log1.join(log3)
        await log1.join(log2)
        await log4.append('helloD1')
        await log4.append('helloD2')
        await log4.join(log2)
        await log4.join(log1)
        await log4.join(log3)
        await log4.append('helloD3')
        await log4.append('helloD4')

        assert.strictEqual(log4.clock.id, testIdentity4.publicKey)
        assert.strictEqual(log4.clock.time, 6)

        const expectedData = [
          'helloA1',
          'helloD1',
          'helloB1',
          'helloA2',
          'helloD2',
          'helloB2',
          'helloC1',
          'helloC2',
          'helloD3',
          'helloD4'
        ]

        assert.strictEqual(log4.length, 10)
        assert.deepStrictEqual(log4.values.map((e) => e.payload), expectedData)
      })

      describe('takes length as an argument', async () => {
        beforeEach(async () => {
          await log1.append('helloA1')
          await log1.append('helloA2')
          await log2.append('helloB1')
          await log2.append('helloB2')
        })

        it('joins only specified amount of entries - one entry', async () => {
          await log1.join(log2, 1)

          const expectedData = [
            'helloB2'
          ]
          const lastEntry = last(log1.values)

          assert.strictEqual(log1.length, 1)
          assert.deepStrictEqual(log1.values.map((e) => e.payload), expectedData)
          assert.strictEqual(lastEntry.next.length, 1)
        })

        it('joins only specified amount of entries - two entries', async () => {
          await log1.join(log2, 2)

          const expectedData = [
            'helloA2', 'helloB2'
          ]
          const lastEntry = last(log1.values)

          assert.strictEqual(log1.length, 2)
          assert.deepStrictEqual(log1.values.map((e) => e.payload), expectedData)
          assert.strictEqual(lastEntry.next.length, 1)
        })

        it('joins only specified amount of entries - three entries', async () => {
          await log1.join(log2, 3)

          const expectedData = [
            'helloB1', 'helloA2', 'helloB2'
          ]
          const lastEntry = last(log1.values)

          assert.strictEqual(log1.length, 3)
          assert.deepStrictEqual(log1.values.map((e) => e.payload), expectedData)
          assert.strictEqual(lastEntry.next.length, 1)
        })

        it('joins only specified amount of entries - (all) four entries', async () => {
          await log1.join(log2, 4)

          const expectedData = [
            'helloA1', 'helloB1', 'helloA2', 'helloB2'
          ]
          const lastEntry = last(log1.values)

          assert.strictEqual(log1.length, 4)
          assert.deepStrictEqual(log1.values.map((e) => e.payload), expectedData)
          assert.strictEqual(lastEntry.next.length, 1)
        })
      })
    })

    describe('fromEntry', () => {
      let identities

      before(async () => {
        identities = [testIdentity, testIdentity2, testIdentity3, testIdentity4]
      })

      it('creates a log from an entry', async () => {
        let fixture = await LogCreator.createLogWithSixteenEntries(ipfs, testACL, identities)
        let data = fixture.log

        let log = await Log.fromEntry(ipfs, testACL, testIdentity, data.heads, -1)
        assert.strictEqual(log.id, data.heads[0].id)
        assert.strictEqual(log.length, 16)
        assert.deepStrictEqual(log.values.map(e => e.payload), fixture.expectedData)
      })

      it('keeps the original heads', async () => {
        let fixture = await LogCreator.createLogWithSixteenEntries(ipfs, testACL, identities)
        let data = fixture.log

        let log1 = await Log.fromEntry(ipfs, testACL, testIdentity, data.heads, data.heads.length)
        assert.strictEqual(log1.id, data.heads[0].id)
        assert.strictEqual(log1.length, data.heads.length)
        assert.strictEqual(log1.values[0].payload, 'entryC0')
        assert.strictEqual(log1.values[1].payload, 'entryA10')

        let log2 = await Log.fromEntry(ipfs, testACL, testIdentity, data.heads, 4)
        assert.strictEqual(log2.id, data.heads[0].id)
        assert.strictEqual(log2.length, 4)
        assert.strictEqual(log2.values[0].payload, 'entryC0')
        assert.strictEqual(log2.values[1].payload, 'entryA8')
        assert.strictEqual(log2.values[2].payload, 'entryA9')
        assert.strictEqual(log2.values[3].payload, 'entryA10')

        let log3 = await Log.fromEntry(ipfs, testACL, testIdentity, data.heads, 7)
        assert.strictEqual(log3.id, data.heads[0].id)
        assert.strictEqual(log3.length, 7)
        assert.strictEqual(log3.values[0].payload, 'entryB5')
        assert.strictEqual(log3.values[1].payload, 'entryA6')
        assert.strictEqual(log3.values[2].payload, 'entryC0')
        assert.strictEqual(log3.values[3].payload, 'entryA7')
        assert.strictEqual(log3.values[4].payload, 'entryA8')
        assert.strictEqual(log3.values[5].payload, 'entryA9')
        assert.strictEqual(log3.values[6].payload, 'entryA10')
      })

      it('onProgress callback is fired for each entry', async () => {
        let items1 = []
        const amount = 100
        for (let i = 1; i <= amount; i++) {
          const prev1 = last(items1)
          const n1 = await Entry.create(ipfs, testIdentity, 'A', 'entryA' + i, [prev1])
          items1.push(n1)
        }

        let i = 0
        const callback = (hash, entry, depth) => {
          assert.notStrictEqual(entry, null)
          assert.strictEqual(hash, items1[items1.length - i - 1].hash)
          assert.strictEqual(entry.hash, items1[items1.length - i - 1].hash)
          assert.strictEqual(entry.payload, items1[items1.length - i - 1].payload)
          assert.strictEqual(depth - 1, i)

          i++
        }

        await Log.fromEntry(ipfs, testACL, testIdentity, last(items1), -1, [], callback)
      })

      it('retrieves partial log from an entry hash', async () => {
        const log1 = new Log(ipfs, testACL, testIdentity, 'X')
        const log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        const log3 = new Log(ipfs, testACL, testIdentity3, 'X')
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for (let i = 1; i <= amount; i++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await Entry.create(ipfs, log1._identity, 'X', 'entryA' + i, [prev1])
          const n2 = await Entry.create(ipfs, log2._identity, 'X', 'entryB' + i, [prev2, n1])
          const n3 = await Entry.create(ipfs, log3._identity, 'X', 'entryC' + i, [prev3, n1, n2])
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        // limit to 10 entries
        const a = await Log.fromEntry(ipfs, testACL, testIdentity, last(items1), 10)
        assert.strictEqual(a.length, 10)

        // limit to 42 entries
        const b = await Log.fromEntry(ipfs, testACL, testIdentity, last(items1), 42)
        assert.strictEqual(b.length, 42)
      })

      it('throws an error if trying to create a log from a hash of an entry', async () => {
        let items1 = []
        const amount = 5
        for (let i = 1; i <= amount; i++) {
          const prev1 = last(items1)
          const n1 = await Entry.create(ipfs, testIdentity, 'A', 'entryA' + i, [prev1])
          items1.push(n1)
        }

        let err
        try {
          await Log.fromEntry(ipfs, testACL, testIdentity, last(items1).hash, 1)
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, `'sourceEntries' argument must be an array of Entry instances or a single Entry`)
      })

      describe('fetches a log', () => {
        const amount = 100

        let log1
        let log2
        let log3
        let items1 = []
        let items2 = []
        let items3 = []

        beforeEach(async () => {
          log1 = new Log(ipfs, testACL, testIdentity, 'X')
          log2 = new Log(ipfs, testACL, testIdentity2, 'X')
          log3 = new Log(ipfs, testACL, testIdentity3, 'X')
          items1 = []
          items2 = []
          items3 = []
          for (let i = 1; i <= amount; i++) {
            const prev1 = last(items1)
            const prev2 = last(items2)
            const prev3 = last(items3)
            const n1 = await Entry.create(ipfs, log1._identity, log1.id, 'entryA' + i, [prev1], log1.clock)
            const n2 = await Entry.create(ipfs, log2._identity, log2.id, 'entryB' + i, [prev2, n1], log2.clock)
            const n3 = await Entry.create(ipfs, log3._identity, log3.id, 'entryC' + i, [prev3, n1, n2], log3.clock)
            log1.clock.tick()
            log2.clock.tick()
            log3.clock.tick()
            log1.clock.merge(log2.clock)
            log1.clock.merge(log3.clock)
            log2.clock.merge(log1.clock)
            log2.clock.merge(log3.clock)
            log3.clock.merge(log1.clock)
            log3.clock.merge(log2.clock)
            items1.push(n1)
            items2.push(n2)
            items3.push(n3)
          }
        })

        it('returns all entries - no excluded entries', async () => {
          const a = await Log.fromEntry(ipfs, testACL, testIdentity, last(items1), -1)
          assert.strictEqual(a.length, amount)
          assert.strictEqual(a.values[0].hash, items1[0].hash)
        })

        it('returns all entries - including excluded entries', async () => {
          // One entry
          const a = await Log.fromEntry(ipfs, testACL, testIdentity, last(items1), -1, [items1[0]])
          assert.strictEqual(a.length, amount)
          assert.strictEqual(a.values[0].hash, items1[0].hash)

          // All entries
          const b = await Log.fromEntry(ipfs, testACL, testIdentity, last(items1), -1, items1)
          assert.strictEqual(b.length, amount)
          assert.strictEqual(b.values[0].hash, items1[0].hash)
        })
      })

      it('retrieves full log from an entry hash', async () => {
        const log1 = new Log(ipfs, testACL, testIdentity, 'X')
        const log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        const log3 = new Log(ipfs, testACL, testIdentity3, 'X')
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for (let i = 1; i <= amount; i++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await Entry.create(ipfs, log1._identity, 'X', 'entryA' + i, [prev1])
          const n2 = await Entry.create(ipfs, log2._identity, 'X', 'entryB' + i, [prev2, n1])
          const n3 = await Entry.create(ipfs, log3._identity, 'X', 'entryC' + i, [prev3, n2])
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await Log.fromEntry(ipfs, testACL, testIdentity, [last(items1)], amount)
        assert.strictEqual(a.length, amount)

        const b = await Log.fromEntry(ipfs, testACL, testIdentity2, [last(items2)], amount * 2)
        assert.strictEqual(b.length, amount * 2)

        const c = await Log.fromEntry(ipfs, testACL, testIdentity3, [last(items3)], amount * 3)
        assert.strictEqual(c.length, amount * 3)
      })

      it('retrieves full log from an entry hash 2', async () => {
        const log1 = new Log(ipfs, testACL, testIdentity, 'X')
        const log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        const log3 = new Log(ipfs, testACL, testIdentity3, 'X')
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for (let i = 1; i <= amount; i++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await Entry.create(ipfs, log1._identity, 'X', 'entryA' + i, [prev1])
          const n2 = await Entry.create(ipfs, log2._identity, 'X', 'entryB' + i, [prev2, n1])
          const n3 = await Entry.create(ipfs, log3._identity, 'X', 'entryC' + i, [prev3, n1, n2])
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await Log.fromEntry(ipfs, testACL, testIdentity, last(items1), amount)
        assert.strictEqual(a.length, amount)

        const b = await Log.fromEntry(ipfs, testACL, testIdentity2, last(items2), amount * 2)
        assert.strictEqual(b.length, amount * 2)

        const c = await Log.fromEntry(ipfs, testACL, testIdentity3, last(items3), amount * 3)
        assert.strictEqual(c.length, amount * 3)
      })

      it('retrieves full log from an entry hash 3', async () => {
        const log1 = new Log(ipfs, testACL, testIdentity, 'X')
        const log2 = new Log(ipfs, testACL, testIdentity3, 'X')
        const log3 = new Log(ipfs, testACL, testIdentity4, 'X')
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for (let i = 1; i <= amount; i++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          log1.clock.tick()
          log2.clock.tick()
          log3.clock.tick()
          const n1 = await Entry.create(ipfs, log1._identity, 'X', 'entryA' + i, [prev1], log1.clock)
          const n2 = await Entry.create(ipfs, log2._identity, 'X', 'entryB' + i, [prev2, n1], log2.clock)
          const n3 = await Entry.create(ipfs, log3._identity, 'X', 'entryC' + i, [prev3, n1, n2], log3.clock)
          log1.clock.merge(log2.clock)
          log1.clock.merge(log3.clock)
          log2.clock.merge(log1.clock)
          log2.clock.merge(log3.clock)
          log3.clock.merge(log1.clock)
          log3.clock.merge(log2.clock)
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await Log.fromEntry(ipfs, testACL, testIdentity, last(items1), amount)
        assert.strictEqual(a.length, amount)

        const itemsInB = [
          'entryA1',
          'entryB1',
          'entryA2',
          'entryB2',
          'entryA3',
          'entryB3',
          'entryA4',
          'entryB4',
          'entryA5',
          'entryB5',
          'entryA6',
          'entryB6',
          'entryA7',
          'entryB7',
          'entryA8',
          'entryB8',
          'entryA9',
          'entryB9',
          'entryA10',
          'entryB10'
        ]

        const b = await Log.fromEntry(ipfs, testACL, testIdentity3, last(items2), amount * 2)
        assert.strictEqual(b.length, amount * 2)
        assert.deepStrictEqual(itemsInB, b.values.map((e) => e.payload))

        let c = await Log.fromEntry(ipfs, testACL, testIdentity4, last(items3), amount * 3)
        await c.append('EOF')
        assert.strictEqual(c.length, amount * 3 + 1)

        const tmp = [
          'entryA1',
          'entryB1',
          'entryC1',
          'entryA2',
          'entryB2',
          'entryC2',
          'entryA3',
          'entryB3',
          'entryC3',
          'entryA4',
          'entryB4',
          'entryC4',
          'entryA5',
          'entryB5',
          'entryC5',
          'entryA6',
          'entryB6',
          'entryC6',
          'entryA7',
          'entryB7',
          'entryC7',
          'entryA8',
          'entryB8',
          'entryC8',
          'entryA9',
          'entryB9',
          'entryC9',
          'entryA10',
          'entryB10',
          'entryC10',
          'EOF'
        ]
        assert.deepStrictEqual(c.values.map(e => e.payload), tmp)

        let logX = new Log(ipfs, testACL, testIdentity2, 'X') // make sure logX comes after A, B and C
        await logX.append('1')
        await logX.append('2')
        await logX.append('3')
        const d = await Log.fromEntry(ipfs, testACL, testIdentity2, last(logX.values), -1)

        await c.join(d)
        await d.join(c)

        await c.append('DONE')
        await d.append('DONE')
        const f = await Log.fromEntry(ipfs, testACL, testIdentity2, last(c.values), -1, [])
        const g = await Log.fromEntry(ipfs, testACL, testIdentity2, last(d.values), -1, [])

        assert.strictEqual(f.toString(), bigLogString)
        assert.strictEqual(g.toString(), bigLogString)
      })

      it('retrieves full log of randomly joined log', async () => {
        let log1 = new Log(ipfs, testACL, testIdentity, 'X')
        let log2 = new Log(ipfs, testACL, testIdentity3, 'X')
        let log3 = new Log(ipfs, testACL, testIdentity4, 'X')

        for (let i = 1; i <= 5; i++) {
          await log1.append('entryA' + i)
        }

        for (let i = 1; i <= 5; i++) {
          await log2.append('entryB' + i)
        }

        await log3.join(log1)
        await log3.join(log2)

        for (let i = 6; i <= 10; i++) {
          await log1.append('entryA' + i)
        }

        await log1.join(log3)

        for (let i = 11; i <= 15; i++) {
          await log1.append('entryA' + i)
        }

        const expectedData = [
          'entryA1', 'entryB1', 'entryA2', 'entryB2',
          'entryA3', 'entryB3', 'entryA4', 'entryB4',
          'entryA5', 'entryB5',
          'entryA6', 'entryA7', 'entryA8', 'entryA9', 'entryA10',
          'entryA11', 'entryA12', 'entryA13', 'entryA14', 'entryA15'
        ]

        assert.deepStrictEqual(log1.values.map(e => e.payload), expectedData)
      })

      it('retrieves randomly joined log deterministically', async () => {
        let logA = new Log(ipfs, testACL, testIdentity, 'X')
        let logB = new Log(ipfs, testACL, testIdentity3, 'X')
        let log3 = new Log(ipfs, testACL, testIdentity4, 'X')
        let log = new Log(ipfs, testACL, testIdentity2, 'X')

        for (let i = 1; i <= 5; i++) {
          await logA.append('entryA' + i)
        }

        for (let i = 1; i <= 5; i++) {
          await logB.append('entryB' + i)
        }

        await log3.join(logA)
        await log3.join(logB)

        for (let i = 6; i <= 10; i++) {
          await logA.append('entryA' + i)
        }

        await log.join(log3)
        await log.append('entryC0')
        await log.join(logA, 16)

        const expectedData = [
          'entryA1', 'entryB1', 'entryA2', 'entryB2',
          'entryA3', 'entryB3', 'entryA4', 'entryB4',
          'entryA5', 'entryB5',
          'entryA6',
          'entryC0', 'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        assert.deepStrictEqual(log.values.map(e => e.payload), expectedData)
      })

      it('sorts', async () => {
        let testLog = await LogCreator.createLogWithSixteenEntries(ipfs, testACL, identities)
        let log = testLog.log
        const expectedData = testLog.expectedData

        const expectedData2 = [
          'entryA1', 'entryB1', 'entryA2', 'entryB2',
          'entryA3', 'entryB3', 'entryA4', 'entryB4',
          'entryA5', 'entryB5',
          'entryA6', 'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        const expectedData3 = [
          'entryA1', 'entryB1', 'entryA2', 'entryB2',
          'entryA3', 'entryB3', 'entryA4', 'entryB4',
          'entryA5', 'entryB5', 'entryA6', 'entryC0',
          'entryA7', 'entryA8', 'entryA9'
        ]

        const expectedData4 = [
          'entryA1', 'entryB1', 'entryA2', 'entryB2',
          'entryA3', 'entryB3', 'entryA4', 'entryB4',
          'entryA5', 'entryA6', 'entryC0', 'entryA7',
          'entryA8', 'entryA9', 'entryA10'
        ]

        let fetchOrder = log.values.slice().sort(Entry.compare)
        assert.deepStrictEqual(fetchOrder.map(e => e.payload), expectedData)

        let reverseOrder = log.values.slice().reverse().sort(Entry.compare)
        assert.deepStrictEqual(fetchOrder, reverseOrder)

        let hashOrder = log.values.slice().sort((a, b) => a.hash > b.hash).sort(Entry.compare)
        assert.deepStrictEqual(fetchOrder, hashOrder)

        let randomOrder2 = log.values.slice().sort((a, b) => 0.5 - Math.random()).sort(Entry.compare)
        assert.deepStrictEqual(fetchOrder, randomOrder2)

        // partial data
        let partialLog = log.values.filter(e => e.payload !== 'entryC0').sort(Entry.compare)
        assert.deepStrictEqual(partialLog.map(e => e.payload), expectedData2)

        let partialLog2 = log.values.filter(e => e.payload !== 'entryA10').sort(Entry.compare)
        assert.deepStrictEqual(partialLog2.map(e => e.payload), expectedData3)

        let partialLog3 = log.values.filter(e => e.payload !== 'entryB5').sort(Entry.compare)
        assert.deepStrictEqual(partialLog3.map(e => e.payload), expectedData4)
      })

      it('sorts deterministically from random order', async () => {
        let testLog = await LogCreator.createLogWithSixteenEntries(ipfs, testACL, identities)
        let log = testLog.log
        const expectedData = testLog.expectedData

        let fetchOrder = log.values.slice().sort(Entry.compare)
        assert.deepStrictEqual(fetchOrder.map(e => e.payload), expectedData)

        let sorted
        for (let i = 0; i < 1000; i++) {
          const randomOrder = log.values.slice().sort((a, b) => 0.5 - Math.random())
          sorted = randomOrder.sort(Entry.compare)
          assert.deepStrictEqual(sorted.map(e => e.payload), expectedData)
        }
      })

      it('sorts entries correctly', async () => {
        let testLog = await LogCreator.createLogWithTwoHundredEntries(ipfs, testACL, identities)
        let log = testLog.log
        const expectedData = testLog.expectedData
        assert.deepStrictEqual(log.values.map(e => e.payload), expectedData)
      })

      it('retrieves partially joined log deterministically - single next pointer', async () => {
        const nextPointerAmount = 1

        let logA = new Log(ipfs, testACL, testIdentity, 'X')
        let logB = new Log(ipfs, testACL, testIdentity3, 'X')
        let log3 = new Log(ipfs, testACL, testIdentity4, 'X')
        let log = new Log(ipfs, testACL, testIdentity2, 'X')

        for (let i = 1; i <= 5; i++) {
          await logA.append('entryA' + i, nextPointerAmount)
        }

        for (let i = 1; i <= 5; i++) {
          await logB.append('entryB' + i, nextPointerAmount)
        }

        await log3.join(logA)
        await log3.join(logB)

        for (let i = 6; i <= 10; i++) {
          await logA.append('entryA' + i, nextPointerAmount)
        }

        await log.join(log3)
        await log.append('entryC0', nextPointerAmount)

        await log.join(logA)

        const mh = await log.toMultihash()

        // First 5
        let res = await Log.fromMultihash(ipfs, testACL, testIdentity2, mh, 5)

        const first5 = [
          'entryA5', 'entryB5', 'entryC0', 'entryA9', 'entryA10'
        ]

        // console.log(log.values.map(e => e.payload))
        // console.log(res.values.map(e => e.payload))
        assert.deepStrictEqual(res.values.map(e => e.payload), first5)

        // First 11
        res = await Log.fromMultihash(ipfs, testACL, testIdentity2, mh, 11)

        const first11 = [
          'entryA3', 'entryB3', 'entryA4', 'entryB4',
          'entryA5', 'entryB5',
          'entryC0',
          'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        assert.deepStrictEqual(res.values.map(e => e.payload), first11)

        // All but one
        res = await Log.fromMultihash(ipfs, testACL, testIdentity2, mh, 16 - 1)

        const all = [
          'entryA1', /* excl */ 'entryA2', 'entryB2', 'entryA3', 'entryB3',
          'entryA4', 'entryB4', 'entryA5', 'entryB5',
          'entryA6',
          'entryC0', 'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        assert.deepStrictEqual(res.values.map(e => e.payload), all)
      })

      it('retrieves partially joined log deterministically - multiple next pointers', async () => {
        const nextPointersAmount = 64

        let logA = new Log(ipfs, testACL, testIdentity, 'X')
        let logB = new Log(ipfs, testACL, testIdentity3, 'X')
        let log3 = new Log(ipfs, testACL, testIdentity4, 'X')
        let log = new Log(ipfs, testACL, testIdentity2, 'X')

        for (let i = 1; i <= 5; i++) {
          await logA.append('entryA' + i, nextPointersAmount)
        }

        for (let i = 1; i <= 5; i++) {
          await logB.append('entryB' + i, nextPointersAmount)
        }

        await log3.join(logA)
        await log3.join(logB)

        for (let i = 6; i <= 10; i++) {
          await logA.append('entryA' + i, nextPointersAmount)
        }

        await log.join(log3)
        await log.append('entryC0', nextPointersAmount)

        await log.join(logA)

        const mh = await log.toMultihash()

        // First 5
        let res = await Log.fromMultihash(ipfs, testACL, testIdentity2, mh, 5)

        const first5 = [
          'entryC0', 'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        assert.deepStrictEqual(res.values.map(e => e.payload), first5)

        // First 11
        res = await Log.fromMultihash(ipfs, testACL, testIdentity2, mh, 11)

        const first11 = [
          'entryA1', 'entryA2', 'entryA3', 'entryA4',
          'entryA5', 'entryA6',
          'entryC0',
          'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        assert.deepStrictEqual(res.values.map(e => e.payload), first11)

        // All but one
        res = await Log.fromMultihash(ipfs, testACL, testIdentity2, mh, 16 - 1)

        const all = [
          'entryA1', /* excl */ 'entryA2', 'entryB2', 'entryA3', 'entryB3',
          'entryA4', 'entryB4', 'entryA5', 'entryB5',
          'entryA6',
          'entryC0', 'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        assert.deepStrictEqual(res.values.map(e => e.payload), all)
      })

      it('throws an error if ipfs is not defined', async () => {
        let err
        try {
          await Log.fromEntry()
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, null)
        assert.strictEqual(err.message, 'ImmutableDB instance not defined')
      })
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
        let log2 = new Log(ipfs, testACL, testIdentity, 'A')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        const log4 = await Log.fromEntry(ipfs, testACL, testIdentity, log1.heads, 2)
        assert.strictEqual(log4.length, 2)
        assert.strictEqual(log4.tails.length, 2)
        assert.strictEqual(log4.tails[0].hash, log4.values[1].hash)
        assert.strictEqual(log4.tails[1].hash, log4.values[0].hash)
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

    describe('is a CRDT', () => {
      let log1, log2, log3

      beforeEach(async () => {
        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        log3 = new Log(ipfs, testACL, testIdentity3, 'X')
      })

      it('join is associative', async () => {
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')

        // a + (b + c)
        await log2.join(log3)
        await log1.join(log2)

        const res1 = log1.values.slice()// .map((e) => e.hash).join(",")

        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        log3 = new Log(ipfs, testACL, testIdentity3, 'X')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')

        // (a + b) + c
        await log1.join(log2)
        await log3.join(log1)

        const res2 = log3.values.slice()// .map((e) => e.hash).join(",")

        // associativity: a + (b + c) == (a + b) + c
        const len = 6// (46 + 1) * 6- 1 // 46 == ipfs hash, +1 == .join(","), * 4 == number of items, -1 == last item doesn't get a ',' from .join
        assert.strictEqual(res1.length, len)
        assert.strictEqual(res2.length, len)
        assert.deepStrictEqual(res1, res2)
      })

      it('join is commutative', async () => {
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')

        // b + a
        await log2.join(log1)
        const res1 = log2.values.slice()// .map((e) => e.hash).join(",")

        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')

        // a + b
        await log1.join(log2)
        const res2 = log1.values.slice()// .map((e) => e.hash).join(",")

        // commutativity: a + b == b + a
        // const len = (46 + 1) * 4 - 1 // 46 == ipfs hash length, +1 == .join(","), * 4 == number of items, -1 == last item doesn't get a ',' from .join
        assert.strictEqual(res1.length, 4)
        assert.strictEqual(res2.length, 4)
        assert.deepStrictEqual(res1, res2)
      })

      it('multiple joins are commutative', async () => {
        // b + a == a + b
        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log2.join(log1)
        const resA1 = log2.toString()

        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        const resA2 = log1.toString()

        assert.strictEqual(resA1, resA2)

        // a + b == b + a
        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log1.join(log2)
        const resB1 = log1.toString()

        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log2.join(log1)
        const resB2 = log2.toString()

        assert.strictEqual(resB1, resB2)

        // a + c == c + a
        log1 = new Log(ipfs, testACL, testIdentity, 'A')
        log3 = new Log(ipfs, testACL, testIdentity3, 'A')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log3.join(log1)
        const resC1 = log3.toString()

        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log3 = new Log(ipfs, testACL, testIdentity3, 'X')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log1.join(log3)
        const resC2 = log1.toString()

        assert.strictEqual(resC1, resC2)

        // c + b == b + c
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        log3 = new Log(ipfs, testACL, testIdentity3, 'X')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log3.join(log2)
        const resD1 = log3.toString()

        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        log3 = new Log(ipfs, testACL, testIdentity3, 'X')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log2.join(log3)
        const resD2 = log2.toString()

        assert.strictEqual(resD1, resD2)

        // a + b + c == c + b + a
        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        log3 = new Log(ipfs, testACL, testIdentity3, 'X')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log1.join(log2)
        await log1.join(log3)
        const logLeft = log1.toString()

        log1 = new Log(ipfs, testACL, testIdentity, 'X')
        log2 = new Log(ipfs, testACL, testIdentity2, 'X')
        log3 = new Log(ipfs, testACL, testIdentity3, 'X')
        await log1.append('helloA1')
        await log1.append('helloA2')
        await log2.append('helloB1')
        await log2.append('helloB2')
        await log3.append('helloC1')
        await log3.append('helloC2')
        await log3.join(log2)
        await log3.join(log1)
        const logRight = log3.toString()

        assert.strictEqual(logLeft, logRight)
      })

      it('join is idempotent', async () => {
        let logA = new Log(ipfs, testACL, testIdentity, 'X')
        await logA.append('helloA1')
        await logA.append('helloA2')
        await logA.append('helloA3')

        // idempotence: a + a = a
        logA.join(logA)
        assert.strictEqual(logA.length, 3)
      })
    })
  })
})
