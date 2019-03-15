'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const LogCreator = require('./utils/log-creator')
const { LastWriteWins } = require('../src/log-sorting')
const bigLogString = require('./fixtures/big-log.fixture.js')
const Entry = require('../src/entry')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')

// Alternate tiebreaker. Always does the opposite of LastWriteWins
const FirstWriteWins = (a, b) => LastWriteWins(a, b) * -1
const BadComparatorReturnsZero = (a, b) => 0

// Test utils
const {
  config,
  MemStore,
  testAPIs,
  startIpfs,
  stopIpfs
} = require('./utils')

let ipfs, testIdentity, testIdentity2, testIdentity3, testIdentity4

const last = (arr) => {
  return arr[arr.length - 1]
}

Object.keys(testAPIs).forEach((IPFS) => {
  describe('Log - Load (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    const { identityKeysPath, signingKeysPath } = config
    const ipfsConfig = Object.assign({}, config.defaultIpfsConfig, {
      repo: config.defaultIpfsConfig.repo + '-log-load' + new Date().getTime()
    })

    let firstWriteExpectedData = [
      'entryA6', 'entryA7', 'entryA8', 'entryA9',
      'entryA10', 'entryB1', 'entryB2', 'entryB3',
      'entryB4', 'entryB5', 'entryA1', 'entryA2',
      'entryA3', 'entryA4', 'entryA5', 'entryC0'
    ]

    before(async () => {
      rmrf.sync(ipfsConfig.repo)
      testIdentity = await IdentityProvider.createIdentity({ id: 'userA', identityKeysPath, signingKeysPath })
      testIdentity2 = await IdentityProvider.createIdentity({ id: 'userB', identityKeysPath, signingKeysPath })
      testIdentity3 = await IdentityProvider.createIdentity({ id: 'userC', identityKeysPath, signingKeysPath })
      testIdentity4 = await IdentityProvider.createIdentity({ id: 'userD', identityKeysPath, signingKeysPath })
      ipfs = await startIpfs(IPFS, ipfsConfig)

      const memstore = new MemStore()
      ipfs.object.put = memstore.put.bind(memstore)
      ipfs.object.get = memstore.get.bind(memstore)
    })

    after(async () => {
      await stopIpfs(ipfs)
      rmrf.sync(ipfsConfig.repo)
    })

    describe('fromJSON', () => {
      let identities

      before(async () => {
        identities = [testIdentity, testIdentity2, testIdentity3, testIdentity4]
      })

      it('creates a log from an entry', async () => {
        let fixture = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
        let data = fixture.log
        let json = fixture.json

        json.heads = await Promise.all(json.heads.map(headCID => Entry.fromCID(ipfs, headCID)))

        let log = await Log.fromJSON(ipfs, testIdentity, json, { logId: 'X' })

        assert.strictEqual(log.id, data.heads[0].id)
        assert.strictEqual(log.length, 16)
        assert.deepStrictEqual(log.values.map(e => e.payload), fixture.expectedData)
      })

      it('creates a log from an entry with custom tiebreaker', async () => {
        let fixture = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
        let data = fixture.log
        let json = fixture.json

        json.heads = await Promise.all(json.heads.map(headCID => Entry.fromCID(ipfs, headCID)))

        let log = await Log.fromJSON(ipfs, testIdentity, json,
          { length: -1, logId: 'X', sortFn: FirstWriteWins })

        assert.strictEqual(log.id, data.heads[0].id)
        assert.strictEqual(log.length, 16)
        assert.deepStrictEqual(log.values.map(e => e.payload), firstWriteExpectedData)
      })
    })

    describe('fromEntryCID', () => {
      let identities

      before(async () => {
        identities = [testIdentity, testIdentity2, testIdentity3, testIdentity4]
      })

      it('creates a log from an entry hash', async () => {
        let fixture = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
        let data = fixture.log
        let json = fixture.json

        let log1 = await Log.fromEntryCid(ipfs, testIdentity, json.heads[0],
          { logId: 'X' })
        let log2 = await Log.fromEntryCid(ipfs, testIdentity, json.heads[1],
          { logId: 'X' })

        await log1.join(log2)

        assert.strictEqual(log1.id, data.heads[0].id)
        assert.strictEqual(log1.length, 16)
        assert.deepStrictEqual(log1.values.map(e => e.payload), fixture.expectedData)
      })

      it('creates a log from an entry hash with custom tiebreaker', async () => {
        let fixture = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
        let data = fixture.log
        let json = fixture.json

        let log1 = await Log.fromEntryCid(ipfs, testIdentity, json.heads[0],
          { logId: 'X', sortFn: FirstWriteWins })
        let log2 = await Log.fromEntryCid(ipfs, testIdentity, json.heads[1],
          { logId: 'X', sortFn: FirstWriteWins })

        await log1.join(log2)

        assert.strictEqual(log1.id, data.heads[0].id)
        assert.strictEqual(log1.length, 16)
        assert.deepStrictEqual(log1.values.map(e => e.payload), firstWriteExpectedData)
      })
    })

    describe('fromEntry', () => {
      let identities

      before(async () => {
        identities = [testIdentity, testIdentity2, testIdentity3, testIdentity4]
      })

      it('creates a log from an entry', async () => {
        let fixture = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
        let data = fixture.log

        let log = await Log.fromEntry(ipfs, testIdentity, data.heads, { length: -1 })
        assert.strictEqual(log.id, data.heads[0].id)
        assert.strictEqual(log.length, 16)
        assert.deepStrictEqual(log.values.map(e => e.payload), fixture.expectedData)
      })

      it('creates a log from an entry with custom tiebreaker', async () => {
        let fixture = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
        let data = fixture.log

        let log = await Log.fromEntry(ipfs, testIdentity, data.heads,
          { length: -1, sortFn: FirstWriteWins })
        assert.strictEqual(log.id, data.heads[0].id)
        assert.strictEqual(log.length, 16)
        assert.deepStrictEqual(log.values.map(e => e.payload), firstWriteExpectedData)
      })

      it('keeps the original heads', async () => {
        let fixture = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
        let data = fixture.log

        let log1 = await Log.fromEntry(ipfs, testIdentity, data.heads,
          { length: data.heads.length })
        assert.strictEqual(log1.id, data.heads[0].id)
        assert.strictEqual(log1.length, data.heads.length)
        assert.strictEqual(log1.values[0].payload, 'entryC0')
        assert.strictEqual(log1.values[1].payload, 'entryA10')

        let log2 = await Log.fromEntry(ipfs, testIdentity, data.heads, { length: 4 })
        assert.strictEqual(log2.id, data.heads[0].id)
        assert.strictEqual(log2.length, 4)
        assert.strictEqual(log2.values[0].payload, 'entryC0')
        assert.strictEqual(log2.values[1].payload, 'entryA8')
        assert.strictEqual(log2.values[2].payload, 'entryA9')
        assert.strictEqual(log2.values[3].payload, 'entryA10')

        let log3 = await Log.fromEntry(ipfs, testIdentity, data.heads, { length: 7 })
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
        const callback = (cid, entry, depth) => {
          assert.notStrictEqual(entry, null)
          assert.strictEqual(cid, items1[items1.length - i - 1].cid)
          assert.strictEqual(entry.cid, items1[items1.length - i - 1].cid)
          assert.strictEqual(entry.payload, items1[items1.length - i - 1].payload)
          assert.strictEqual(depth - 1, i)

          i++
        }

        await Log.fromEntry(ipfs, testIdentity, last(items1),
          { length: -1, exclude: [], onProgressCallback: callback })
      })

      it('retrieves partial log from an entry CID', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        const log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        const log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
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
        const a = await Log.fromEntry(ipfs, testIdentity, last(items1), { length: 10 })
        assert.strictEqual(a.length, 10)

        // limit to 42 entries
        const b = await Log.fromEntry(ipfs, testIdentity, last(items1), { length: 42 })
        assert.strictEqual(b.length, 42)
      })

      it('throws an error if trying to create a log from a CID of an entry', async () => {
        let items1 = []
        const amount = 5
        for (let i = 1; i <= amount; i++) {
          const prev1 = last(items1)
          const n1 = await Entry.create(ipfs, testIdentity, 'A', 'entryA' + i, [prev1])
          items1.push(n1)
        }

        let err
        try {
          await Log.fromEntry(ipfs, testIdentity, last(items1).cid, { length: 1 })
        } catch (e) {
          err = e
        }
        assert.strictEqual(err.message, `'sourceEntries' argument must be an array of Entry instances or a single Entry`)
      })

      it('retrieves full log from an entry CID', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        const log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        const log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
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

        const a = await Log.fromEntry(ipfs, testIdentity, [last(items1)],
          { length: amount })
        assert.strictEqual(a.length, amount)

        const b = await Log.fromEntry(ipfs, testIdentity2, [last(items2)],
          { length: amount * 2 })
        assert.strictEqual(b.length, amount * 2)

        const c = await Log.fromEntry(ipfs, testIdentity3, [last(items3)],
          { length: amount * 3 })
        assert.strictEqual(c.length, amount * 3)
      })

      it('retrieves full log from an entry CID 2', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        const log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
        const log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
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

        const a = await Log.fromEntry(ipfs, testIdentity, last(items1),
          { length: amount })
        assert.strictEqual(a.length, amount)

        const b = await Log.fromEntry(ipfs, testIdentity2, last(items2),
          { length: amount * 2 })
        assert.strictEqual(b.length, amount * 2)

        const c = await Log.fromEntry(ipfs, testIdentity3, last(items3),
          { length: amount * 3 })
        assert.strictEqual(c.length, amount * 3)
      })

      it('retrieves full log from an entry CID 3', async () => {
        const log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        const log2 = new Log(ipfs, testIdentity3, { logId: 'X' })
        const log3 = new Log(ipfs, testIdentity4, { logId: 'X' })
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

        const a = await Log.fromEntry(ipfs, testIdentity, last(items1),
          { length: amount })
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

        const b = await Log.fromEntry(ipfs, testIdentity3, last(items2),
          { length: amount * 2 })
        assert.strictEqual(b.length, amount * 2)
        assert.deepStrictEqual(b.values.map((e) => e.payload), itemsInB)

        let c = await Log.fromEntry(ipfs, testIdentity4, last(items3),
          { length: amount * 3 })
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

        // make sure logX comes after A, B and C
        let logX = new Log(ipfs, testIdentity2, { logId: 'X' })
        await logX.append('1')
        await logX.append('2')
        await logX.append('3')
        const d = await Log.fromEntry(ipfs, testIdentity2, last(logX.values),
          { length: -1 })

        await c.join(d)
        await d.join(c)

        await c.append('DONE')
        await d.append('DONE')
        const f = await Log.fromEntry(ipfs, testIdentity2, last(c.values),
          { amount: -1, exclude: [] })
        const g = await Log.fromEntry(ipfs, testIdentity2, last(d.values),
          { length: -1, exclude: [] })

        assert.strictEqual(f.toString(), bigLogString)
        assert.strictEqual(g.toString(), bigLogString)
      })

      it('retrieves full log of randomly joined log', async () => {
        let log1 = new Log(ipfs, testIdentity, { logId: 'X' })
        let log2 = new Log(ipfs, testIdentity3, { logId: 'X' })
        let log3 = new Log(ipfs, testIdentity4, { logId: 'X' })

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
        let logA = new Log(ipfs, testIdentity, { logId: 'X' })
        let logB = new Log(ipfs, testIdentity3, { logId: 'X' })
        let log3 = new Log(ipfs, testIdentity4, { logId: 'X' })
        let log = new Log(ipfs, testIdentity2, { logId: 'X' })

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
        let testLog = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
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

        let cidOrder = log.values.slice().sort((a, b) => a.cid > b.cid).sort(Entry.compare)
        assert.deepStrictEqual(fetchOrder, cidOrder)

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
        let testLog = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
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
        let testLog = await LogCreator.createLogWithTwoHundredEntries(ipfs, identities)
        let log = testLog.log
        const expectedData = testLog.expectedData
        assert.deepStrictEqual(log.values.map(e => e.payload), expectedData)
      })

      it('sorts entries according to custom tiebreaker function', async () => {
        let testLog = await LogCreator.createLogWithSixteenEntries(ipfs, identities)

        let firstWriteWinsLog =
          new Log(ipfs, identities[0], { logId: 'X', sortFn: FirstWriteWins })
        await firstWriteWinsLog.join(testLog.log)
        assert.deepStrictEqual(firstWriteWinsLog.values.map(e => e.payload),
          firstWriteExpectedData)
      })

      it('throws an error if the tiebreaker returns zero', async () => {
        let testLog = await LogCreator.createLogWithSixteenEntries(ipfs, identities)
        let firstWriteWinsLog =
          new Log(ipfs, identities[0], { logId: 'X', sortFn: BadComparatorReturnsZero })
        await firstWriteWinsLog.join(testLog.log)
        assert.throws(() => firstWriteWinsLog.values, Error, 'Error Thrown')
      })

      it('retrieves partially joined log deterministically - single next pointer', async () => {
        const nextPointerAmount = 1

        let logA = new Log(ipfs, testIdentity, { logId: 'X' })
        let logB = new Log(ipfs, testIdentity3, { logId: 'X' })
        let log3 = new Log(ipfs, testIdentity4, { logId: 'X' })
        let log = new Log(ipfs, testIdentity2, { logId: 'X' })

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

        const cid = await log.toCID()

        // First 5
        let res = await Log.fromCID(ipfs, testIdentity2, cid, { length: 5 })

        const first5 = [
          'entryA5', 'entryB5', 'entryC0', 'entryA9', 'entryA10'
        ]

        assert.deepStrictEqual(res.values.map(e => e.payload), first5)

        // First 11
        res = await Log.fromCID(ipfs, testIdentity2, cid, { length: 11 })

        const first11 = [
          'entryA3', 'entryB3', 'entryA4', 'entryB4',
          'entryA5', 'entryB5',
          'entryC0',
          'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        assert.deepStrictEqual(res.values.map(e => e.payload), first11)

        // All but one
        res = await Log.fromCID(ipfs, testIdentity2, cid, { length: 16 - 1 })

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

        let logA = new Log(ipfs, testIdentity, { logId: 'X' })
        let logB = new Log(ipfs, testIdentity3, { logId: 'X' })
        let log3 = new Log(ipfs, testIdentity4, { logId: 'X' })
        let log = new Log(ipfs, testIdentity2, { logId: 'X' })

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

        const cid = await log.toCID()

        // First 5
        let res = await Log.fromCID(ipfs, testIdentity2, cid, { length: 5 })

        const first5 = [
          'entryC0', 'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        assert.deepStrictEqual(res.values.map(e => e.payload), first5)

        // First 11
        res = await Log.fromCID(ipfs, testIdentity2, cid, { length: 11 })

        const first11 = [
          'entryA1', 'entryA2', 'entryA3', 'entryA4',
          'entryA5', 'entryA6',
          'entryC0',
          'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        assert.deepStrictEqual(res.values.map(e => e.payload), first11)

        // All but one
        res = await Log.fromCID(ipfs, testIdentity2, cid, { length: 16 - 1 })

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
        assert.strictEqual(err.message, 'IPFS instance not defined')
      })

      describe('fetches a log', () => {
        const amount = 100
        let items1 = []
        let items2 = []
        let items3 = []
        let log1, log2, log3

        beforeEach(async () => {
          const ts = new Date().getTime()
          log1 = new Log(ipfs, testIdentity, { logId: 'X' })
          log2 = new Log(ipfs, testIdentity2, { logId: 'X' })
          log3 = new Log(ipfs, testIdentity3, { logId: 'X' })
          items1 = []
          items2 = []
          items3 = []
          for (let i = 1; i <= amount; i++) {
            const prev1 = last(items1)
            const prev2 = last(items2)
            const prev3 = last(items3)
            const n1 = await Entry.create(ipfs, log1._identity, log1.id, 'entryA' + i + '-' + ts, [prev1], log1.clock)
            const n2 = await Entry.create(ipfs, log2._identity, log2.id, 'entryB' + i + '-' + ts, [prev2, n1], log2.clock)
            const n3 = await Entry.create(ipfs, log3._identity, log3.id, 'entryC' + i + '-' + ts, [prev3, n1, n2], log3.clock)
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
          const a = await Log.fromEntry(ipfs, testIdentity, last(items1),
            { length: -1 })
          assert.strictEqual(a.length, amount)
          assert.strictEqual(a.values[0].cid, items1[0].cid)
        })

        it('returns all entries - including excluded entries', async () => {
          // One entry
          const a = await Log.fromEntry(ipfs, testIdentity, last(items1),
            { length: -1, exclude: [items1[0]] })
          assert.strictEqual(a.length, amount)
          assert.strictEqual(a.values[0].cid, items1[0].cid)

          // All entries
          const b = await Log.fromEntry(ipfs, testIdentity, last(items1),
            { length: -1, exclude: items1 })
          assert.strictEqual(b.length, amount)
          assert.strictEqual(b.values[0].cid, items1[0].cid)
        })
      })
    })
  })
})
