'use strict'

const assert = require('assert')
const sinon = require('sinon')
const rmrf = require('rimraf')
const dagPB = require('ipld-dag-pb')
const pify = require('pify')
const Clock = require('../src/lamport-clock')
const Entry = require('../src/entry')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')

const createPbDagNode = pify(dagPB.DAGNode.create)

// For tiebreaker testing
const { LastWriteWins } = require('../src/log-sorting')
const FirstWriteWins = (a, b) => LastWriteWins(a, b) * -1

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

    const { identityKeysPath, signingKeysPath } = config
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, {
      repo: config.defaultIpfsConfig.repo + '-log' + new Date().getTime()
    })

    before(async () => {
      rmrf.sync(ipfsConfig.repo)
      testIdentity = await IdentityProvider.createIdentity({ id: 'userA', identityKeysPath, signingKeysPath })
      testIdentity2 = await IdentityProvider.createIdentity({ id: 'userB', identityKeysPath, signingKeysPath })
      testIdentity3 = await IdentityProvider.createIdentity({ id: 'userC', identityKeysPath, signingKeysPath })
      ipfs = await startIpfs(IPFS, ipfsConfig)
    })

    after(async () => {
      await stopIpfs(ipfs)
      rmrf.sync(ipfsConfig.repo)
    })

    describe('constructor', async () => {
      it('creates an empty log with default params', () => {
        const log = new Log(ipfs, testIdentity)
        assert.notStrictEqual(log._entryIndex, null)
        assert.notStrictEqual(log._headsIndex, null)
        assert.notStrictEqual(log._id, null)
        assert.notStrictEqual(log.id, null)
        assert.notStrictEqual(log.clock, null)
        assert.notStrictEqual(log.values, null)
        assert.notStrictEqual(log.heads, null)
        assert.notStrictEqual(log.tails, null)
        assert.notStrictEqual(log.tailCids, null)
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
        const log = new Log(ipfs, testIdentity, { logId: 'ABC' })
        assert.strictEqual(log.id, 'ABC')
      })

      it('sets the clock id', () => {
        const log = new Log(ipfs, testIdentity, { logId: 'ABC' })
        assert.strictEqual(log.id, 'ABC')
        assert.strictEqual(log.clock.id, testIdentity.publicKey)
      })

      it('generates id string if id is not passed as an argument', () => {
        const log = new Log(ipfs, testIdentity)
        assert.strictEqual(typeof log.id === 'string', true)
      })

      it('sets items if given as params', async () => {
        const one = await Entry.create(ipfs, testIdentity, 'A', 'entryA', [], new Clock('A', 0))
        const two = await Entry.create(ipfs, testIdentity, 'A', 'entryB', [], new Clock('B', 0))
        const three = await Entry.create(ipfs, testIdentity, 'A', 'entryC', [], new Clock('C', 0))
        const log = new Log(ipfs, testIdentity,
          { logId: 'A', entries: [one, two, three] })
        assert.strictEqual(log.length, 3)
        assert.strictEqual(log.values[0].payload, 'entryA')
        assert.strictEqual(log.values[1].payload, 'entryB')
        assert.strictEqual(log.values[2].payload, 'entryC')
      })

      it('sets heads if given as params', async () => {
        const one = await Entry.create(ipfs, testIdentity, 'A', 'entryA', [])
        const two = await Entry.create(ipfs, testIdentity, 'A', 'entryB', [])
        const three = await Entry.create(ipfs, testIdentity, 'A', 'entryC', [])
        const log = new Log(ipfs, testIdentity,
          { logId: 'B', entries: [one, two, three], heads: [three] })
        assert.strictEqual(log.heads.length, 1)
        assert.strictEqual(log.heads[0].cid, three.cid)
      })

      it('finds heads if heads not given as params', async () => {
        const one = await Entry.create(ipfs, testIdentity, 'A', 'entryA', [])
        const two = await Entry.create(ipfs, testIdentity, 'A', 'entryB', [])
        const three = await Entry.create(ipfs, testIdentity, 'A', 'entryC', [])
        const log = new Log(ipfs, testIdentity,
          { logId: 'A', entries: [one, two, three] })
        assert.strictEqual(log.heads.length, 3)
        assert.strictEqual(log.heads[2].cid, one.cid)
        assert.strictEqual(log.heads[1].cid, two.cid)
        assert.strictEqual(log.heads[0].cid, three.cid)
      })

      it('throws an error if entries is not an array', () => {
        let err
        try {
          let log = new Log(ipfs, testIdentity, { logId: 'A', entries: {} }) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, undefined)
        assert.strictEqual(err.message, `'entries' argument must be an array of Entry instances`)
      })

      it('throws an error if heads is not an array', () => {
        let err
        try {
          let log = new Log(ipfs, testIdentity, { logId: 'A', entries: [], heads: {} }) // eslint-disable-line no-unused-vars
        } catch (e) {
          err = e
        }
        assert.notStrictEqual(err, undefined)
        assert.strictEqual(err.message, `'heads' argument must be an array`)
      })

      it('creates default public AccessController if not defined', async () => {
        const log = new Log(ipfs, testIdentity) // eslint-disable-line no-unused-vars
        const anyoneCanAppend = await log._access.canAppend('any')
        assert.notStrictEqual(log._access, undefined)
        assert.strictEqual(anyoneCanAppend, true)
      })

      it('throws an error if identity is not defined', () => {
        let err
        try {
          const log = new Log(ipfs) // eslint-disable-line no-unused-vars
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
        log = new Log(ipfs, testIdentity, { logId: 'A' })
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
        log = new Log(ipfs, testIdentity, { logId: 'AAA' })
        await log.append('one')
      })

      it('returns an Entry', () => {
        const entry = log.get(log.values[0].cid)
        assert.deepStrictEqual(entry.cid, 'zdpuB2kFv5s6UjDaCWkjE3mNnDVgYHLBrFamYonJZ5xtvtg4v')
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
          cid: 'zdpuB2kFv5s6UjDaCWkjE3mNnDVgYHLBrFamYonJZ5xtvtg4v',
          id: 'AAA',
          payload: 'one',
          next: [],
          v: 1,
          clock: new Clock(testIdentity.publicKey, 1),
          key: testIdentity.toJSON()
        }
        const sig = testIdentity.provider.sign(testIdentity, Buffer.from(JSON.stringify(expectedData)))
        Object.assign(expectedData, { sig })
      })

      beforeEach(async () => {
        log = new Log(ipfs, testIdentity, { logId: 'AAA' })
        await log.append('one')
      })

      it('returns true if it has an Entry', () => {
        assert.strictEqual(log.has(expectedData), true)
      })

      it('returns true if it has an Entry, CID lookup', () => {
        assert.strictEqual(log.has(expectedData.cid), true)
      })

      it('returns false if it doesn\'t have the Entry', () => {
        assert.strictEqual(log.has('zdFoo'), false)
      })
    })

    describe('serialize', async () => {
      let log//, testIdentity2, testIdentity3, testIdentity4
      const expectedData = {
        id: 'AAA',
        heads: ['zdpuAw6yxK132nAvHtZiWSsEgDd55AgCpjc44jFizqSscwAKR']
      }

      beforeEach(async () => {
        log = new Log(ipfs, testIdentity, { logId: 'AAA' })
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
          heads: ['zdpuAw6yxK132nAvHtZiWSsEgDd55AgCpjc44jFizqSscwAKR'],
          values: [
            'zdpuB2kFv5s6UjDaCWkjE3mNnDVgYHLBrFamYonJZ5xtvtg4v',
            'zdpuApQir9nBg7SAts4gx5naAh77qLzP3Xtmda3RHj9msPatg',
            'zdpuAw6yxK132nAvHtZiWSsEgDd55AgCpjc44jFizqSscwAKR'
          ]
        }

        it('returns the log snapshot', () => {
          const snapshot = log.toSnapshot()
          assert.strictEqual(snapshot.id, expectedData.id)
          assert.strictEqual(snapshot.heads.length, expectedData.heads.length)
          assert.strictEqual(snapshot.heads[0].cid, expectedData.heads[0])
          assert.strictEqual(snapshot.values.length, expectedData.values.length)
          assert.strictEqual(snapshot.values[0].cid, expectedData.values[0])
          assert.strictEqual(snapshot.values[1].cid, expectedData.values[1])
          assert.strictEqual(snapshot.values[2].cid, expectedData.values[2])
        })
      })

      describe('toBuffer', () => {
        it('returns the log as a Buffer', () => {
          assert.deepStrictEqual(log.toBuffer(), Buffer.from(JSON.stringify(expectedData)))
        })
      })

      describe('toCID', async () => {
        it('returns the log as ipfs CID', async () => {
          const expectedCid = 'zdpuArva1LTmn5zFYyAfpbxmXRwge2gwiWdJogSHfaJiBWSU9'
          let log = new Log(ipfs, testIdentity, { logId: 'A' })
          await log.append('one')
          const cid = await log.toCID()
          assert.strictEqual(cid, expectedCid)
        })

        it('log serialized to ipfs contains the correct data', async () => {
          const expectedData = {
            id: 'A',
            heads: ['zdpuAojkSxbS84ai4FxpLzxohXiquwzNSXMozr7syKfC7sKi7']
          }
          const expectedCid = 'zdpuArva1LTmn5zFYyAfpbxmXRwge2gwiWdJogSHfaJiBWSU9'
          let log = new Log(ipfs, testIdentity, { logId: 'A' })
          await log.append('one')
          const cid = await log.toCID()
          assert.strictEqual(cid, expectedCid)
          const result = await ipfs.dag.get(cid)
          const heads = result.value.heads.map(head => head.toBaseEncodedString())
          assert.deepStrictEqual(heads, expectedData.heads)
        })

        it('throws an error if log items is empty', async () => {
          const emptyLog = new Log(ipfs, testIdentity)
          let err
          try {
            await emptyLog.toCID()
          } catch (e) {
            err = e
          }
          assert.notStrictEqual(err, null)
          assert.strictEqual(err.message, 'Can\'t serialize an empty log')
        })
      })

      describe('toMultihash', async () => {
        it('returns the log as ipfs multihash', async () => {
          const expectedMultihash = 'Qmavo9Z6hJcVhDcsc2t7Stg2EpHyPeArCeNmucCjmUP55C'
          let log = new Log(ipfs, testIdentity, { logId: 'A' })
          await log.append('one')
          const multihash = await log.toMultihash()
          assert.strictEqual(multihash, expectedMultihash)
        })

        it('log serialized to ipfs contains the correct data', async () => {
          const expectedData = {
            id: 'A',
            heads: ['zdpuAojkSxbS84ai4FxpLzxohXiquwzNSXMozr7syKfC7sKi7']
          }
          const expectedMultihash = 'Qmavo9Z6hJcVhDcsc2t7Stg2EpHyPeArCeNmucCjmUP55C'
          let log = new Log(ipfs, testIdentity, { logId: 'A' })
          await log.append('one')
          const multihash = await log.toMultihash()
          assert.strictEqual(multihash, expectedMultihash)
          const result = await ipfs.object.get(multihash)
          const res = JSON.parse(result.toJSON().data.toString())
          assert.deepStrictEqual(res.heads, expectedData.heads)
        })

        it('throws an error if log items is empty', async () => {
          const emptyLog = new Log(ipfs, testIdentity)
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

      describe('fromCID', async () => {
        it('creates a log from ipfs CID - one entry', async () => {
          const expectedData = {
            id: 'X',
            heads: ['zdpuB2NAQ7cSh9MAfY91QC6Va56pQMJBXBaLoS6uQ1qNxqija']
          }
          let log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const cid = await log.toCID()
          const res = await Log.fromCID(ipfs, testIdentity, cid, -1)
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
          assert.strictEqual(res.length, 1)
          assert.strictEqual(res.values[0].payload, 'one')
          assert.strictEqual(res.values[0].clock.id, testIdentity.publicKey)
          assert.strictEqual(res.values[0].clock.time, 1)
        })

        it('creates a log from ipfs CID - three entries', async () => {
          const cid = await log.toCID()
          const res = await Log.fromCID(ipfs, testIdentity, cid, -1)
          assert.strictEqual(res.length, 3)
          assert.strictEqual(res.values[0].payload, 'one')
          assert.strictEqual(res.values[0].clock.time, 1)
          assert.strictEqual(res.values[1].payload, 'two')
          assert.strictEqual(res.values[1].clock.time, 2)
          assert.strictEqual(res.values[2].payload, 'three')
          assert.strictEqual(res.values[2].clock.time, 3)
        })

        it('creates a log from ipfs multihash (backwards compat)', async () => {
          const expectedData = {
            id: 'X',
            heads: ['zdpuB2NAQ7cSh9MAfY91QC6Va56pQMJBXBaLoS6uQ1qNxqija']
          }
          let log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const multihash = await log.toMultihash()
          const res = await Log.fromCID(ipfs, testIdentity, multihash, { length: -1 })
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
          assert.strictEqual(res.length, 1)
          assert.strictEqual(res.values[0].payload, 'one')
          assert.strictEqual(res.values[0].clock.id, testIdentity.publicKey)
          assert.strictEqual(res.values[0].clock.time, 1)
        })

        it('has the right sequence number after creation and appending', async () => {
          const cid = await log.toCID()
          let res = await Log.fromCID(ipfs, testIdentity, cid, { length: -1 })
          assert.strictEqual(res.length, 3)
          await res.append('four')
          assert.strictEqual(res.length, 4)
          assert.strictEqual(res.values[3].payload, 'four')
          assert.strictEqual(res.values[3].clock.time, 4)
        })

        it('creates a log from ipfs CID that has three heads', async () => {
          let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
          let log2 = new Log(ipfs, testIdentity2, { logId: 'A' })
          let log3 = new Log(ipfs, testIdentity3, { logId: 'A' })
          await log1.append('one') // order is determined by the identity's publicKey
          await log3.append('two')
          await log2.append('three')
          await log1.join(log2)
          await log1.join(log3)
          const cid = await log1.toCID()
          const res = await Log.fromCID(ipfs, testIdentity, cid, { length: -1 })
          assert.strictEqual(res.length, 3)
          assert.strictEqual(res.heads.length, 3)
          assert.strictEqual(res.heads[0].payload, 'three')
          assert.strictEqual(res.heads[1].payload, 'two') // order is determined by the identity's publicKey
          assert.strictEqual(res.heads[2].payload, 'one')
        })

        it('creates a log from ipfs CID that has three heads w/ custom tiebreaker', async () => {
          let log1 = new Log(ipfs, testIdentity, { logId: 'A' })
          let log2 = new Log(ipfs, testIdentity2, { logId: 'A' })
          let log3 = new Log(ipfs, testIdentity3, { logId: 'A' })
          await log1.append('one') // order is determined by the identity's publicKey
          await log3.append('two')
          await log2.append('three')
          await log1.join(log2)
          await log1.join(log3)
          const cid = await log1.toCID()
          const res = await Log.fromCID(ipfs, testIdentity, cid,
            { sortFn: FirstWriteWins })
          assert.strictEqual(res.length, 3)
          assert.strictEqual(res.heads.length, 3)
          assert.strictEqual(res.heads[0].payload, 'one')
          assert.strictEqual(res.heads[1].payload, 'two') // order is determined by the identity's publicKey
          assert.strictEqual(res.heads[2].payload, 'three')
        })

        it('creates a log from ipfs CID up to a size limit', async () => {
          const amount = 100
          const size = amount / 2
          let log = new Log(ipfs, testIdentity, { logId: 'A' })
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }
          const cid = await log.toCID()
          const res = await Log.fromCID(ipfs, testIdentity, cid, { length: size })
          assert.strictEqual(res.length, size)
        })

        it('creates a log from ipfs CID up without size limit', async () => {
          const amount = 100
          let log = new Log(ipfs, testIdentity, { logId: 'A' })
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }
          const cid = await log.toCID()
          const res = await Log.fromCID(ipfs, testIdentity, cid, { length: -1 })
          assert.strictEqual(res.length, amount)
        })

        it('throws an error if ipfs is not defined', async () => {
          let err
          try {
            await Log.fromCID()
          } catch (e) {
            err = e
          }
          assert.notStrictEqual(err, null)
          assert.strictEqual(err.message, 'IPFS instance not defined')
        })

        it('throws an error if CID is not defined', async () => {
          let err
          try {
            await Log.fromCID(ipfs)
          } catch (e) {
            err = e
          }
          assert.notStrictEqual(err, null)
          assert.strictEqual(err.message, 'Invalid CID: undefined')
        })

        it('throws an error if data from CID is not valid JSON', async () => {
          const dagNode = await createPbDagNode(Buffer.from('hello'))
          let cid = await ipfs.dag.put(dagNode, {
            hashAlg: 'sha2-256',
            format: 'dag-pb'
          })
          let err
          try {
            await Log.fromCID(ipfs, testIdentity, cid.toBaseEncodedString())
          } catch (e) {
            err = e
          }
          assert.strictEqual(err.message, 'Unexpected token h in JSON at position 0')
        })

        it('throws an error when data from CID is not instance of Log', async () => {
          const cid = await ipfs.dag.put({})
          let err
          try {
            await Log.fromCID(ipfs, testIdentity, cid)
          } catch (e) {
            err = e
          }
          assert.strictEqual(err.message, 'Given argument is not an instance of Log')
        })

        it('onProgress callback is fired for each entry', async () => {
          const amount = 100
          let log = new Log(ipfs, testIdentity, { logId: 'A' })
          for (let i = 0; i < amount; i++) {
            await log.append(i.toString())
          }

          const items = log.values
          let i = 0
          const loadProgressCallback = (cid, entry, depth) => {
            assert.notStrictEqual(entry, null)
            assert.strictEqual(cid, items[items.length - i - 1].cid)
            assert.strictEqual(entry.cid, items[items.length - i - 1].cid)
            assert.strictEqual(entry.payload, items[items.length - i - 1].payload)
            assert.strictEqual(depth - 1, i)
            i++
          }

          const cid = await log.toCID()
          const result = await Log.fromCID(ipfs, testIdentity, cid,
            { length: -1, exclude: [], onProgressCallback: loadProgressCallback })

          // Make sure the onProgress callback was called for each entry
          assert.strictEqual(i, amount)
          // Make sure the log entries are correct ones
          assert.strictEqual(result.values[0].clock.time, 1)
          assert.strictEqual(result.values[0].payload, '0')
          assert.strictEqual(result.values[result.length - 1].clock.time, 100)
          assert.strictEqual(result.values[result.length - 1].payload, '99')
        })
      })

      describe('fromEntryHash', async () => {
        afterEach(() => {
          if (Log.fromEntryCid.restore) {
            Log.fromEntryCid.restore()
          }
        })

        it('calls fromEntryCid', async () => {
          const spy = sinon.spy(Log, 'fromEntryCid')
          const expectedData = {
            id: 'X',
            heads: ['zdpuB2NAQ7cSh9MAfY91QC6Va56pQMJBXBaLoS6uQ1qNxqija']
          }
          let log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const res = await Log.fromEntryHash(ipfs, testIdentity, expectedData.heads[0],
            { logId: log.id, length: -1 })
          assert(spy.calledOnceWith(ipfs, testIdentity, expectedData.heads[0],
            {
              logId: 'X',
              access: undefined,
              length: -1,
              exclude: undefined,
              onProgressCallback: undefined,
              sortFn: undefined
            }))
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
        })
      })

      describe('fromMultihash', async () => {
        afterEach(() => {
          if (Log.fromCID.restore) {
            Log.fromCID.restore()
          }
        })

        it('calls fromCID', async () => {
          const spy = sinon.spy(Log, 'fromCID')
          const expectedData = {
            id: 'X',
            heads: ['zdpuB2NAQ7cSh9MAfY91QC6Va56pQMJBXBaLoS6uQ1qNxqija']
          }
          let log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const multihash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, multihash, { length: -1 })
          assert(spy.calledOnceWith(ipfs, testIdentity, multihash,
            { access: undefined, length: -1, exclude: undefined, onProgressCallback: undefined, sortFn: undefined }))
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
        })

        it('calls fromCID with custom tiebreaker', async () => {
          const spy = sinon.spy(Log, 'fromCID')
          const expectedData = {
            id: 'X',
            heads: ['zdpuB2NAQ7cSh9MAfY91QC6Va56pQMJBXBaLoS6uQ1qNxqija']
          }
          let log = new Log(ipfs, testIdentity, { logId: 'X' })
          await log.append('one')
          const multihash = await log.toMultihash()
          const res = await Log.fromMultihash(ipfs, testIdentity, multihash,
            { length: -1, sortFn: FirstWriteWins })
          assert(spy.calledOnceWith(ipfs, testIdentity, multihash,
            {
              access: undefined,
              length: -1,
              exclude: undefined,
              onProgressCallback: undefined,
              sortFn: FirstWriteWins
            }))
          assert.strictEqual(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
        })
      })
    })

    describe('values', () => {
      it('returns all entries in the log', async () => {
        let log = new Log(ipfs, testIdentity)
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
