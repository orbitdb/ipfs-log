'use strict'

const assert = require('assert')
const async = require('asyncawait/async')
const await = require('asyncawait/await')
const rmrf = require('rimraf')
const apis = require('./config/test-apis')
const config = require('./config/ipfs-daemon.config')
const LogCreator = require('./utils/log-creator')
const bigLogString = require('./fixtures/big-log.fixture.js')
const Log = require('../src/log-utils.js')
const Entry = require('../src/entry')
const EntrySet = require('../src/entry-set')

let ipfs, ipfsDaemon

const last = (arr) => {
  return arr[arr.length - 1]
}

apis.forEach((IpfsDaemon) => {

  describe('Log', function() {
    this.timeout(40000)

    before((done) => {
      rmrf.sync(config.daemon1.IpfsDataDir)
      ipfs = new IpfsDaemon(config.daemon1)
      ipfs.on('error', done)
      ipfs.on('ready', () => done())
    })

    after(() => {
      ipfs.stop()
      rmrf.sync(config.daemon1.IpfsDataDir)
    })

    describe('create', async(() => {
      it('creates an empty log', async(() => {
        const log = Log.create('A')
        assert.notEqual(log._entries, null)
        assert.notEqual(log._id, null)
        assert.notEqual(log.id, null)
        assert.notEqual(log.clock, null)
        assert.notEqual(log.entries, null)
        assert.notEqual(log.values, null)
        assert.notEqual(log.heads, null)
        assert.notEqual(log.tails, null)
        assert.notEqual(log.tailHashes, null)
      }))

      it('creates an empty log and sets default params', async(() => {
        const log = Log.create('A')
        assert.notEqual(log.id, null)
        assert.deepEqual(log.values, [])
        assert.deepEqual(log.heads, [])
        assert.deepEqual(log.tails, [])
      }))

      it('sets id', async(() => {
        const log = Log.create('ABC')
        assert.equal(log.id, 'ABC')
      }))

      it('sets items if given as params', async(() => {
        const one = await(Entry.create(ipfs, 'A', 0, 'entryA'))
        const two = await(Entry.create(ipfs, 'B', 0, 'entryB'))
        const three = await(Entry.create(ipfs, 'C', 0, 'entryC'))
        const log = Log.create('A', [one, two, three])
        assert.equal(log.length, 3)
        assert.equal(log.values[0].payload, 'entryA')
        assert.equal(log.values[1].payload, 'entryB')
        assert.equal(log.values[2].payload, 'entryC')
      }))

      it('sets heads if given as params', async(() => {
        const one = await(Entry.create(ipfs, 'A', 0, 'entryA'))
        const two = await(Entry.create(ipfs, 'B', 0, 'entryB'))
        const three = await(Entry.create(ipfs, 'C', 0, 'entryC'))
        const log = Log.create('B', [one, two, three], [three.hash])
        assert.equal(log.heads.length, 1)
        assert.equal(log.heads[0].hash, three.hash)
      }))

      it('finds heads if heads not given as params', async(() => {
        const one = await(Entry.create(ipfs, 'A', 0, 'entryA'))
        const two = await(Entry.create(ipfs, 'B', 0, 'entryB'))
        const three = await(Entry.create(ipfs, 'C', 0, 'entryC'))
        const log = Log.create('A', [one, two, three])
        assert.equal(log.heads.length, 3)
        assert.equal(log.heads[0].hash, one.hash)
        assert.equal(log.heads[1].hash, two.hash)
        assert.equal(log.heads[2].hash, three.hash)
      }))

      it('sets id from entries', async(() => {
        const one = await(Entry.create(ipfs, 'XXX', 0, 'one'))
        let err
        let log
        try {
          log = Log.create(null, [one])
        } catch(e) {
          err = e
        }
        assert.equal(err, null)
        assert.equal(log.id, 'XXX')
        assert.equal(log.length, 1)
      }))

      it('sets id from entries - IDs are sorted', async(() => {
        const one = await(Entry.create(ipfs, 'Z', 0, 'one'))
        const two = await(Entry.create(ipfs, 'G', 0, 'two'))
        const three = await(Entry.create(ipfs, 'Y', 0, 'three'))
        let err
        let log
        try {
          log = Log.create(null, [one, two, three])
        } catch(e) {
          err = e
        }
        assert.equal(err, null)
        assert.equal(log.id, 'G')
        assert.equal(log.heads.length, 3)
        assert.equal(log.length, 3)
      }))

      it('throws an error if id is not given', async(() => {
        let err
        try {
          const log = Log.create()
        } catch(e) {
          err = e
        }
        assert.equal(err.message, 'Log requires an id')
      }))

      it('throws an error if entries is not an array', async(() => {
        let err
        try {
          const log = Log.create('A', {})
        } catch(e) {
          err = e
        }
        assert.notEqual(err, undefined)
        assert.equal(err.message, `'entries' argument must be an EntrySet or an array of Entry instances`)
      }))

      it('throws an error if heads is not an array', async(() => {
        let err
        try {
          const log = Log.create('A', [], {})
        } catch(e) {
          err = e
        }
        assert.notEqual(err, undefined)
        assert.equal(err.message, `'heads' argument must be an array`)
      }))
    }))

    describe('toString', async(() => {
      let log
      const expectedData = "five\n└─four\n  └─three\n    └─two\n      └─one"

      beforeEach(async(() => {
        log = Log.create('A')
        log = await(Log.append(ipfs, log, "one"))
        log = await(Log.append(ipfs, log, "two"))
        log = await(Log.append(ipfs, log, "three"))
        log = await(Log.append(ipfs, log, "four"))
        log = await(Log.append(ipfs, log, "five"))
      }))

      it('returns a nicely formatted string', () => {
        assert.equal(log.toString(), expectedData)
      })
    }))

    describe('get', async(() => {
      let log

      const expectedData = { 
        hash: 'QmP95CDhWuYy7tfztBK1KnbUZaN2aVi6BERMoH5sQi1fGD',
        id: 'logi',
        // seq: 0,
        payload: 'one',
        next: [],
        v: 0,
        clock: { 
          id: 'logi',
          time: 1,
        },
      }

      beforeEach(async(() => {
        log = Log.create('logi')
        log = await(Log.append(ipfs, log, "one"))
      }))

      it('returns an Entry', () => {
        const entry = log.get(log.values[0].hash)
        assert.deepEqual(entry, expectedData)
      })

      it('returns undefined when Entry is not in the log', () => {
        const entry = log.get('QmFoo')
        assert.deepEqual(entry, null)
      })
    }))

    describe('serialize', async(() => {
      let log
      const expectedData = {
        id: 'logi',
        heads: ['QmWUzUpkbPjzbz29YdCmF8n7APHwpY8Da9z3TGTo82S1AR']
      }

      beforeEach(async(() => {
        log = Log.create('logi')
        log = await(Log.append(ipfs, log, "one"))
        log = await(Log.append(ipfs, log, "two"))
        log = await(Log.append(ipfs, log, "three"))
      }))

      describe('toJSON', () => {
        it('returns the log in JSON format', () => {
          assert.equal(JSON.stringify(log.toJSON()), JSON.stringify(expectedData))
        })
      })

      describe('toBuffer', () => {
        it('returns the log as a Buffer', () => {
          assert.deepEqual(log.toBuffer(), new Buffer(JSON.stringify(expectedData)))
        })
      })

      describe('toMultihash', async(() => {
        it('returns the log as ipfs hash', async(() => {
          const expectedHash = 'QmRBDr8hL2witZjfGUfEQB7RjGJatNqGhFpWzKZDd3bJJp'
          let log = Log.create('A')
          log = await(Log.append(ipfs, log, 'one'))
          const hash = await(Log.toMultihash(ipfs, log))
          assert.equal(hash, expectedHash)
        }))

        it('log serialized to ipfs contains the correct data', async(() => {
          const expectedData = { 
            id: 'A',
            heads: ['QmTctXe3aLBowJkNFZjH1U5JzHJtP6bHjagno6AxcHuua4']
          }
          const expectedHash = 'QmRBDr8hL2witZjfGUfEQB7RjGJatNqGhFpWzKZDd3bJJp'
          let log = Log.create('A')
          log = await(Log.append(ipfs, log, 'one'))
          const hash = await(Log.toMultihash(ipfs, log))
          assert.equal(hash, expectedHash)
          const res = await(ipfs.object.get(hash, { enc: 'base58' }))
          const result = JSON.parse(res.toJSON().data.toString())
          assert.deepEqual(result.heads, expectedData.heads)
        }))

        it('throws an error if ipfs is not defined', () => {
          let err
          try {
            Log.toMultihash()
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Ipfs instance not defined')
        })

        it('throws an error if log is not defined', () => {
          let err
          try {
            Log.toMultihash(ipfs)
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Log instance not defined')
        })

        it('throws an error if given log is not a Log', () => {
          let err
          try {
            Log.toMultihash(ipfs, { items: [1] })
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Given argument is not an instance of Log')
        })

        it('throws an error if log items is empty', () => {
          const emptyLog = Log.create('A')
          let err
          try {
            Log.toMultihash(ipfs, emptyLog)
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Can\'t serialize an empty log')
        })
      }))

      describe('fromMultihash', async(() => {
        it('creates a log from ipfs hash - one entry', async(() => {
          const expectedData = {
            id: 'X',
            heads: ['QmZqF7oMvGyucRJYx9cFxg22Mj6LUDFyDBCZY4kuKwmTH1']
          }
          let log = Log.create('X')
          log = await(Log.append(ipfs, log, 'one'))
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash))
          assert.equal(JSON.stringify(res.toJSON()), JSON.stringify(expectedData))
          assert.equal(res.length, 1)
          assert.equal(res.values[0].payload, 'one')
          assert.equal(res.values[0].clock.id, 'X')
          assert.equal(res.values[0].clock.time, 1)
        }))

        it('creates a log from ipfs hash - three entries', async(() => {
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash))
          assert.equal(res.length, 3)
          assert.equal(res.values[0].payload, 'one')
          // assert.equal(res.values[0].seq, 0)
          assert.equal(res.values[0].clock.time, 1)
          assert.equal(res.values[1].payload, 'two')
          // assert.equal(res.values[1].seq, 1)
          assert.equal(res.values[1].clock.time, 2)
          assert.equal(res.values[2].payload, 'three')
          // assert.equal(res.values[2].seq, 2)
          assert.equal(res.values[2].clock.time, 3)
        }))

        it('has the right sequence number after creation and appending', async(() => {
          const hash = await(Log.toMultihash(ipfs, log))
          let res = await(Log.fromMultihash(ipfs, hash))
          res = await(Log.append(ipfs, res, 'four'))
          assert.equal(res.values[3].payload, 'four')
          // assert.equal(res.values[3].seq, 3)
          assert.equal(res.values[3].clock.time, 4)
        }))

        it('creates a log from ipfs hash that has three heads', async(() => {
          let log1 = Log.create('A')
          let log2 = Log.create('B')
          let log3 = Log.create('C')
          log1 = await(Log.append(ipfs, log1, "one"))
          log2 = await(Log.append(ipfs, log2, "two"))
          log3 = await(Log.append(ipfs, log3, "three"))
          const log4 = Log.join(log1, log2)
          const log5 = Log.join(log4, log3)
          const hash = await(Log.toMultihash(ipfs, log5))
          const res = await(Log.fromMultihash(ipfs, hash))
          assert.equal(res.length, 3)
          assert.equal(res.heads.length, 3)
          assert.equal(res.values[0].payload, 'one')
          assert.equal(res.values[1].payload, 'two')
          assert.equal(res.values[2].payload, 'three')
        }))

        it('creates a log from ipfs hash up to a size limit', async(() => {
          const amount = 100
          const size = amount / 2
          let log = Log.create('A')
          for (let i = 0; i < amount; i ++) {
            log = await(Log.append(ipfs, log, i.toString()))
          }
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash, size))
          assert.equal(res.length, size)
        }))

        it('creates a log from ipfs hash up without size limit', async(() => {
          const amount = 100
          let log = Log.create('A')
          for (let i = 0; i < amount; i ++) {
            log = await(Log.append(ipfs, log, i.toString()))
          }
          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash, -1))
          assert.equal(res.length, amount)
        }))

        it('throws an error if ipfs is not defined', () => {
          let err
          try {
            const log = Log.fromMultihash()
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Ipfs instance not defined')
        })

        it('throws an error if hash is not defined', () => {
          let err
          try {
            const log = Log.fromMultihash(ipfs)
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, 'Invalid hash: undefined')
        })

        it('throws an error when data from hash is not instance of Log', async(() => {
          let err
          const res = await(ipfs.object.put(new Buffer('{}')))
          try {
            await(Log.fromMultihash(ipfs, res.toJSON().multihash))
          } catch(e) {
            err = e
          }
          assert.equal(err.message, 'Given argument is not an instance of Log')
        }))

        it('throws an error if data from hash is not valid JSON', async(() => {
          let err
          const res = await(ipfs.object.put(new Buffer('hello')))
          try {
            await(Log.fromMultihash(ipfs, res.toJSON().multihash))
          } catch(e) {
            err = e
          }
          assert.equal(err.message, 'Unexpected token h in JSON at position 0')
        }))

        it('onProgress callback is fired for each entry', async(() => {
          const amount = 100
          let log = Log.create('A')
          for (let i = 0; i < amount; i ++) {
            log = await(Log.append(ipfs, log, i.toString()))
          }

          const items = log.values
          let i = 0
          const callback = (hash, entry, depth) => {
            assert.notEqual(entry, null)
            assert.equal(hash, items[items.length - i - 1].hash)
            assert.equal(entry.hash, items[items.length - i - 1].hash)
            assert.equal(entry.payload, items[items.length - i - 1].payload)
            assert.equal(depth - 1, i)
            i ++
          }

          const hash = await(Log.toMultihash(ipfs, log))
          const res = await(Log.fromMultihash(ipfs, hash, -1, [], callback))
        }))

      }))
    }))

    describe('items', () => {
      it('returns all entrys in the log', async(() => {
        let log = Log.create('A')
        let items = log.values
        assert.equal(log.values instanceof Array, true)
        assert.equal(log.length, 0)
        log = await(Log.append(ipfs, log, "hello1"))
        log = await(Log.append(ipfs, log, "hello2"))
        log = await(Log.append(ipfs, log, "hello3"))
        assert.equal(log.values instanceof Array, true)
        assert.equal(log.length, 3)
        assert.equal(log.values[0].payload, 'hello1')
        assert.equal(log.values[1].payload, 'hello2')
        assert.equal(log.values[2].payload, 'hello3')
      }))
    })

    describe('append', () => {
      it('adds an item to an empty log', async(() => {
        let log1 = Log.create('A')
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        assert.equal(log2.length, 1)
        assert.equal(log2.values[0].payload, 'hello1')
        assert.equal(log2.values[0].clock.time, 1)
      }))

      it('doesn\'t modify original log', async(() => {
        let log1 = Log.create('A')
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        assert.equal(log1.length, 0)
      }))

      it('copies the previous entries', async(() => {
        let log1 = Log.create('A')
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        const log3 = await(Log.append(ipfs, log2, "hello2"))
        assert.equal(log3.values[0].hash, log2.values[0].hash)
      }))

      it('has the right heads after append', async(() => {
        let log1 = Log.create('A')
        const log2 = await(Log.append(ipfs, log1, "hello1"))
        const log3 = await(Log.append(ipfs, log2, "hello2"))
        const last = log3.values[log3.length - 1]
        assert.equal(log2.heads.length, 1)
        assert.equal(log3.heads.length, 1)
        assert.equal(log2.heads[0].hash, log2.values[0].hash)
        assert.equal(last.hash, log3.heads[0].hash)
        assert.equal(last.payload, 'hello2')
      }))

      it('adds 100 items to a log', async(() => {
        const amount = 100
        let log = Log.create('A')

        for(let i = 1; i <= amount; i ++) {
          log = await(Log.append(ipfs, log, "hello" + i))
        }

        assert.equal(log.length, amount)

        for(let k = 0; k < amount; k ++) {
          const entry = log.values[k]
          assert.equal(entry.payload, 'hello' + (k + 1))
          // assert.equal(entry.seq, k)
          assert.equal(entry.clock.time, k + 1)
          if (k > 0)
            assert.equal(entry.next.length, 1)
        }
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log.append()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if log is not defined', () => {
        let err
        try {
          Log.append(ipfs)
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })

      it('throws an error if given log is not a Log instance', () => {
        let err
        try {
          Log.append(ipfs, {})
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Given argument is not an instance of Log')
      })

      it('throws an error if given log is not a Log instance - heads', () => {
        let err
        try {
          Log.append(ipfs, { heads: [] })
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Given argument is not an instance of Log')
      })

      it('throws an error if given log is not a Log instance - items', () => {
        let err
        try {
          Log.append(ipfs, { heads: [], items: [] })
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Given argument is not an instance of Log')
      })
    })

    describe('join', () => {
      let log1, log2, log3, log4

      beforeEach(async(() => {
        log1 = Log.create('A')
        log2 = Log.create('B')
        log3 = Log.create('C')
        log4 = Log.create('D')
      }))

      it('joins logs', async(() => {
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n1, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const logA = await(Log.fromEntry(ipfs, last(items2)))
        const logB = await(Log.fromEntry(ipfs, last(items3)))
        assert.equal(logA.length, items2.length + items1.length)
        assert.equal(logB.length, items3.length + items2.length + items1.length)

        const log = Log.join(logA, logB)

        assert.equal(log.length, items3.length + items2.length + items1.length)
        // The last entry, 'entryC100', should be the only head 
        // (it points to entryB100, entryB100 and entryC99)
        assert.equal(log.heads.length, 1)
      }))

      it('throws an error if first log is not defined', () => {
        let err
        try {
          Log.join()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })

      it('throws an error if second log is not defined', () => {
        let err
        try {
          Log.join(log1)
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })

      it('throws an error if passed argument is not an instance of Log', () => {
        let err
        try {
          Log.join(log1, {})
        } catch(e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Given argument is not an instance of Log')
      })

      it('joins only unique items', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(log1, log2)
        log1 = Log.join(log1, log2)

        const expectedData = [ 
          'helloA1', 'helloB1', 'helloA2', 'helloB2',
        ]

        assert.equal(log1.length, 4)
        assert.deepEqual(log1.values.map((e) => e.payload), expectedData)

        const item = last(log1.values)
        assert.equal(item.next.length, 1)
      }))

      it('joins logs two ways', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(log1, log2)
        log2 = Log.join(log2, log1)


        const expectedData = [ 
          'helloA1', 'helloB1', 'helloA2', 'helloB2',
        ]

        assert.deepEqual(log1.values.map((e) => e.hash), log2.values.map((e) => e.hash))
        assert.deepEqual(log1.values.map((e) => e.payload), expectedData)
        assert.deepEqual(log2.values.map((e) => e.payload), expectedData)
      }))

      it('doesn\'t change original logs on join', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        const log3 = Log.join(log1, log2)
        const log4 = Log.join(log2, log1)
        assert.equal(log1.length, 1)
        assert.equal(log2.length, 2)
        assert.equal(log3.length, 3)
        assert.equal(log4.length, 3)
        assert.equal(last(log1.values).payload, 'helloA1')
        assert.equal(last(log2.values).payload, 'helloB2')
      }))

      it('joins logs twice', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = Log.join(log2, log1, -1, log2.id)

        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log2 = Log.join(log2, log1)

        const expectedData = [ 
          'helloA1', 'helloB1', 'helloA2', 'helloB2',
        ]

        assert.equal(log2.length, 4)
        assert.deepEqual(log2.values.map((e) => e.payload), expectedData)
      }))

      it('joins 2 logs two ways', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = Log.join(log2, log1, -1, log2.id) // Make sure we keep the original log id
        log1 = Log.join(log1, log2)

        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log2 = Log.join(log2, log1)

        const expectedData = [
          'helloA1', 'helloB1', 'helloA2', 'helloB2', 
        ]

        assert.equal(log2.length, 4)
        assert.deepEqual(log2.values.map((e) => e.payload), expectedData)
      }))


      it('joins 4 logs to one', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log4 = await(Log.append(ipfs, log4, "helloD1"))
        log4 = await(Log.append(ipfs, log4, "helloD2"))
        log1 = Log.join(log1, log2)
        log1 = Log.join(log1, log3)
        log1 = Log.join(log1, log4)

        const expectedData = [ 
          'helloA1',
          'helloB1',
          'helloC1',
          'helloD1',
          'helloA2',
          'helloB2',
          'helloC2',
          'helloD2',
        ]

        assert.equal(log1.length, 8)
        assert.deepEqual(log1.values.map(e => e.payload), expectedData)
      }))

      it('joins 4 logs to one is commutative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log4 = await(Log.append(ipfs, log4, "helloD1"))
        log4 = await(Log.append(ipfs, log4, "helloD2"))
        log1 = Log.join(log1, log2)
        log1 = Log.join(log1, log3)
        log1 = Log.join(log1, log4)
        log2 = Log.join(log2, log1)
        log2 = Log.join(log2, log3)
        log2 = Log.join(log2, log4)

        assert.equal(log1.length, 8)
        assert.deepEqual(log1.values.map(e => e.payload), log2.values.map(e => e.payload))
      }))

      it('joins logs and updates clocks', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = Log.join(log2, log1, -1, log2.id)
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))

        assert.equal(log1.clock.id, log1.id)
        assert.equal(log2.clock.id, log2.id)
        assert.deepEqual(log1.clock.time, 2)
        assert.deepEqual(log2.clock.time, 2)

        log3 = Log.join(log3, log1, -1, log3.id)
        assert.equal(log3.id, 'C')
        assert.equal(log3.clock.id, log3.id)
        assert.deepEqual(log3.clock.time, 2)

        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log1 = Log.join(log1, log3, -1, log1.id)
        log1 = Log.join(log1, log2, -1, log1.id)
        log4 = await(Log.append(ipfs, log4, "helloD1"))
        log4 = await(Log.append(ipfs, log4, "helloD2"))
        log4 = Log.join(log4, log2, -1, log4.id)
        log4 = Log.join(log4, log1, -1, log4.id)
        log4 = Log.join(log4, log3, -1, log4.id)
        log4 = await(Log.append(ipfs, log4, "helloD3"))
        log4 = await(Log.append(ipfs, log4, "helloD4"))

        log1 = Log.join(log1, log4, -1, log1.id)
        log4 = Log.join(log4, log1, -1, log4.id)
        log4 = await(Log.append(ipfs, log4, "helloD5"))
        log1 = await(Log.append(ipfs, log1, "helloA5"))
        log4 = Log.join(log4, log1, -1, log4.id)
        assert.deepEqual(log4.clock.id, log4.id)
        assert.deepEqual(log4.clock.time, 7)

        log4 = await(Log.append(ipfs, log4, "helloD6"))
        assert.deepEqual(log4.clock.time, 8)

        const expectedData = [ 
          { payload: 'helloA1', id: 'A', clock: { id: 'A', time: 1} },
          { payload: 'helloB1', id: 'B', clock: { id: 'B', time: 1} },
          { payload: 'helloD1', id: 'D', clock: { id: 'D', time: 1} },
          { payload: 'helloA2', id: 'A', clock: { id: 'A', time: 2} },
          { payload: 'helloB2', id: 'B', clock: { id: 'B', time: 2} },
          { payload: 'helloD2', id: 'D', clock: { id: 'D', time: 2} },
          { payload: 'helloC1', id: 'C', clock: { id: 'C', time: 3} },
          { payload: 'helloC2', id: 'C', clock: { id: 'C', time: 4} },
          { payload: 'helloD3', id: 'D', clock: { id: 'D', time: 5} },
          { payload: 'helloD4', id: 'D', clock: { id: 'D', time: 6} },
          { payload: 'helloA5', id: 'A', clock: { id: 'A', time: 7} },
          { payload: 'helloD5', id: 'D', clock: { id: 'D', time: 7} },
          { payload: 'helloD6', id: 'D', clock: { id: 'D', time: 8} },
        ]

        const transformed = log4.values.map((e) => {
          return { payload: e.payload, id: e.id, clock: e.clock }
        })

        assert.equal(log4.length, 13)
        assert.deepEqual(transformed, expectedData)
      }))

      it('joins logs from 4 logs', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1")) // 1
        log1 = Log.join(log1, log2, -1, log1.id) // 1
        log2 = await(Log.append(ipfs, log2, "helloB1")) // 1
        log2 = Log.join(log2, log1, -1, log2.id) // 1
        log1 = await(Log.append(ipfs, log1, "helloA2")) // 2
        log2 = await(Log.append(ipfs, log2, "helloB2")) // 2

        log1 = Log.join(log1, log3, -1, log1.id)
        assert.equal(log1.clock.id, log1.id)
        assert.equal(log1.clock.time, 2)

        log3 = Log.join(log3, log1, -1, log3.id)
        assert.equal(log3.clock.id, log3.id)
        assert.equal(log3.clock.time, 2)

        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log1 = Log.join(log1, log3, -1, log1.id)
        log1 = Log.join(log1, log2, -1, log1.id)
        log4 = await(Log.append(ipfs, log4, "helloD1"))
        log4 = await(Log.append(ipfs, log4, "helloD2"))
        log4 = Log.join(log4, log2, -1, log4.id)
        log4 = Log.join(log4, log1, -1, log4.id)
        log4 = Log.join(log4, log3, -1, log4.id)
        log4 = await(Log.append(ipfs, log4, "helloD3"))
        log4 = await(Log.append(ipfs, log4, "helloD4"))

        assert.equal(log4.clock.id, log4.id)
        assert.equal(log4.clock.time, 6)

        const expectedData = [ 
          'helloA1',
          'helloB1',
          'helloD1',
          'helloA2',
          'helloB2',
          'helloD2',
          'helloC1',
          'helloC2',
          'helloD3',
          'helloD4',
        ]

        assert.equal(log4.length, 10)
        assert.deepEqual(log4.values.map((e) => e.payload), expectedData)
      }))

      describe('takes length as an argument', async(() => {
        beforeEach(async(() => {
          log1 = await(Log.append(ipfs, log1, "helloA1"))
          log1 = await(Log.append(ipfs, log1, "helloA2"))
          log2 = await(Log.append(ipfs, log2, "helloB1"))
          log2 = await(Log.append(ipfs, log2, "helloB2"))
        }))

        it('joins only specified amount of entries - one entry', async(() => {
          log1 = Log.join(log1, log2, 1)

          const expectedData = [ 
            'helloB2',
          ]
          const lastEntry = last(log1.values)

          assert.equal(log1.length, 1)
          assert.deepEqual(log1.values.map((e) => e.payload), expectedData)
          assert.equal(lastEntry.next.length, 1)
        }))

        it('joins only specified amount of entries - two entries', async(() => {
          log1 = Log.join(log1, log2, 2)

          const expectedData = [ 
            'helloA2', 'helloB2',
          ]
          const lastEntry = last(log1.values)

          assert.equal(log1.length, 2)
          assert.deepEqual(log1.values.map((e) => e.payload), expectedData)
          assert.equal(lastEntry.next.length, 1)
        }))

        it('joins only specified amount of entries - three entries', async(() => {
          log1 = Log.join(log1, log2, 3)

          const expectedData = [ 
            'helloB1', 'helloA2', 'helloB2',
          ]
          const lastEntry = last(log1.values)

          assert.equal(log1.length, 3)
          assert.deepEqual(log1.values.map((e) => e.payload), expectedData)
          assert.equal(lastEntry.next.length, 1)
        }))

        it('joins only specified amount of entries - (all) four entries', async(() => {
          log1 = Log.join(log1, log2, 4)

          const expectedData = [ 
            'helloA1', 'helloB1', 'helloA2', 'helloB2',
          ]
          const lastEntry = last(log1.values)

          assert.equal(log1.length, 4)
          assert.deepEqual(log1.values.map((e) => e.payload), expectedData)
          assert.equal(lastEntry.next.length, 1)
        }))
      }))
    })

    describe('joinAll', () => {
      it('joins all logs', async(() => {
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n1, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const logA = Log.create('AA', items1.concat(items2))
        const logB = Log.create('BB', items1.concat(items2).concat(items3))

        assert.equal(logA.length, items2.length + items1.length)
        assert.equal(logB.length, items3.length + items2.length + items1.length)

        const log = Log.joinAll([logA, logB])

        assert.equal(log.length, items3.length + items2.length + items1.length)
        assert.equal(log.heads.length, 1)
      }))
    })

    describe('expand', () => {
      const amount = 100

      let log1
      let log2
      let log3
      let items1
      let items2
      let items3

      beforeEach(async(() => {
        log1 = Log.create('A')
        log2 = Log.create('B')
        log3 = Log.create('C')
        items1 = []
        items2 = []
        items3 = []
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1], log1.clock))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2], log2.clock))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n2, n1], log3.clock))
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
      }))

      describe('expand from specific entries', async(() => {
        it('expands the log from specified entries', async(() => {
          // Limit the log size to 10 entries
          const a = await(Log.fromEntry(ipfs, last(items3), 10))
          assert.equal(a.length, 10)

          const fetchFrom = a.values[4] // entryA99

          const expectedData = [
            'entryA94', 
            'entryA95', 
            'entryA96', 
            'entryA97'
          ].concat(a.values.map(e => e.payload))

          const b = await(Log.expandFrom(ipfs, a, [fetchFrom], 4))
          assert.equal(b.length, 14)
          assert.deepEqual(b.values.map(e => e.payload), expectedData)
        }))

        it('throws an error if entries are not defined', async(() => {
          let err
          try {
            const a = await(Log.fromEntry(ipfs, last(items3), 10))
            await(Log.expandFrom(ipfs, a))
          } catch (e) {
            err = e
          }
          assert.notEqual(err, null)
          assert.equal(err.message, `'entries' must be given as argument`)
        }))
      }))

      it('expands the log', async(() => {
        // Limit the log size to 10 entries
        const a = await(Log.fromEntry(ipfs, last(items3), 10))
        assert.equal(a.length, 10)

        // Expand to 20 entries
        const b = await(Log.expand(ipfs, a, 10))
        assert.equal(b.length, 20)
        assert.deepEqual(b.values.slice(-10), a.values)

        // Expand to max
        const c = await(Log.expand(ipfs, b, 300))
        assert.equal(c.length, amount * 3)
        assert.deepEqual(c.values.slice(-10), b.values.slice(-10))

        // Check for idempotency of expand()
        const d = await(Log.expand(ipfs, c))
        assert.equal(d.length, c.length)
        assert.deepEqual(c.values, d.values)
      }))

      it('expands the log to maximum', async(() => {
        let fixture = await(LogCreator.createLog1(ipfs))
        let data = fixture.log

        let log = await(Log.fromEntry(ipfs, data.heads, data.heads.length + 1))
        assert.equal(log.id, data.heads[0].id)
        assert.equal(log.length, data.heads.length + 1)
        
        assert.equal(log.values[0].payload, 'entryC0')
        assert.equal(log.values[1].payload, 'entryA9')
        assert.equal(log.values[2].payload, 'entryA10')

        log = await(Log.expand(ipfs, log, -1))

        // const expectedData = [ 
        //   'entryA1', 'entryB1', 'entryA2', 'entryB2', 'entryA3', 'entryB3',
        //   'entryA4', 'entryB4', 'entryA5', 'entryB5',           
        //   'entryA6', 
        //   'entryC0', 'entryA7', 'entryA8', 'entryA9', 'entryA10',
        // ]
        const expectedData = fixture.expectedData

        assert.deepEqual(log.values.map(e => e.payload), expectedData)
      }))


      it('expands the log one item at a time - one chain', async(() => {
        let log = await(Log.fromEntry(ipfs, last(items3), 1))
        assert.equal(log.length, 1)
        assert.equal(log.values[0].payload, 'entryC100')

        for(let i = 1; i < amount - 1; i ++) {
          log = await(Log.expand(ipfs, log, 1))

          // Check that we expanded one new item
          assert.equal(log.length, i + 1)
        }

        // Check that the last 3 items are correct and in order
        assert.equal(log.values[0].payload, 'entryA68')
        assert.equal(log.values[1].payload, 'entryB68')
        assert.equal(log.values[2].payload, 'entryC68')
        assert.equal(log.values[log.length - 1].payload, 'entryC100')
      }))

      it('expands the log one item at a time - multiple chains', async(() => {
        let fixture = await(LogCreator.createLog1(ipfs))
        let data = fixture.log

        let log = await(Log.fromEntry(ipfs, data.heads, data.heads.length + 1))
        assert.equal(log.length, data.heads.length + 1)
        assert.equal(log.id, data.heads[0].id)
        assert.equal(log.values[0].payload, 'entryC0')
        assert.equal(log.values[1].payload, 'entryA9')
        assert.equal(log.values[2].payload, 'entryA10')

        // const expectedData = [ 
        //   'entryA1', 'entryB1', 'entryA2', 'entryB2', 'entryA3', 'entryB3',
        //   'entryA4', 'entryB4', 'entryA5', 'entryB5',           
        //   'entryA6', 
        //   'entryC0', 'entryA7', 'entryA8', 'entryA9', 'entryA10',
        // ]
        const expectedData = fixture.expectedData

        for(let i = expectedData.length - 1; i >= 0; i --) {
          log = await(Log.expand(ipfs, log, 1))

          if (i < expectedData.length - 2) {
            const lastItems = expectedData.slice(-(log.length - 0))
            assert.deepEqual(log.values.map(e => e.payload), lastItems)
          } else {
            // The first two rounds are special cases:
            // Since C0 is a tail and tails get sorted by id + seq,
            // C0 is sorted after the last Ax entry, eg. 'A8', 'C0', 'A9', 'A10'
            const lastItems = expectedData.slice(-(log.length - 1))
            const entryC0 = expectedData[11]
            lastItems.splice(0, 0, entryC0)
            assert.deepEqual(log.values.map(e => e.payload), lastItems)
          }
        }
      }))

      it('keeps the original entries on expand', async(() => {
        let fixture = await(LogCreator.createLog1(ipfs))
        let data = fixture.log

        let original = await(Log.fromEntry(ipfs, data.heads, data.heads.length))
        assert.deepEqual(original.values.map(e => e.payload), ['entryC0', 'entryA10'])

        let log1 = Log.create('1')
        log1 = await(Log.append(ipfs, log1, 'HELLO1'))
        log1 = await(Log.append(ipfs, log1, 'HELLO11'))
        let log2 = Log.create('2')
        log2 = await(Log.append(ipfs, log2, 'HELLO2'))
        let log3 = Log.create('3')
        log3 = await(Log.append(ipfs, log3, 'HELLO3'))
        let log4 = Log.create('4')
        log4 = await(Log.append(ipfs, log4, 'HELLO4'))

        let joined = Log.joinAll([original, log1, log2, log3, log4])

        const expectedData = [
          'HELLO1', 'HELLO2', 'HELLO3', 'HELLO4', 'HELLO11',
        ]

        const first4 = [
          'entryA7', 'entryA8', 'entryA9', 'entryA10'
        ]

        const last2 = [
          'entryA1', 'entryB1',
        ]

        const rest = [
          /*'entryA1', 'entryB1',*/ 'entryA2', 'entryB2', 
          'entryA3', 'entryB3', 'entryA4', 'entryB4', 
          'entryA5', 'entryB5', 'entryA6',
        ]

        joined = await(Log.expand(ipfs, joined, 1))

        for (let i = 1; i <= fixture.expectedData.length + 5; i++) {
          joined = await(Log.expand(ipfs, joined, 1))
          if (i < 3) {
            const expect = expectedData
              .concat(['entryC0'])
              .concat(first4.slice(-(data.heads.length + i)))

            assert.deepEqual(joined.values.map(e => e.payload), expect)
          } else if (i === 3) {
            const expect = expectedData
              .concat(rest.slice(-(i - 2)))
              .concat(['entryC0'])
              .concat(first4.slice(-(data.heads.length + i)))

            assert.deepEqual(joined.values.map(e => e.payload), expect)
          } else if (i > 11) {
            const expect = expectedData.slice(0, expectedData.length - 1) // Remove 'HELLO11'
              .concat(last2.slice(-(i - 11)))
              .concat(['HELLO11'])
              .concat(rest)
              .concat(['entryC0'])
              .concat(first4.slice(-(data.heads.length + i)))

            assert.deepEqual(joined.values.map(e => e.payload), expect)
          } else {
            const expect = expectedData
              .concat(rest.slice(-(i - 2)))
              .concat(['entryC0'])
              .concat(first4)

            assert.deepEqual(joined.values.map(e => e.payload), expect)
          }
        }
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log.expand()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if log is not defined', () => {
        let err
        try {
          Log.expand(ipfs)
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Log instance not defined')
      })
    })

    describe('fromEntry', () => {
      it('creates a log from an entry', async(() => {
        let fixture = await(LogCreator.createLog1(ipfs))
        let data = fixture.log

        let log = await(Log.fromEntry(ipfs, data.heads))
        assert.equal(log.id, data.heads[0].id)
        assert.equal(log.length, 16)
        assert.deepEqual(log.values.map(e => e.payload), fixture.expectedData)
      }))


      it('keeps the original heads', async(() => {
        let fixture = await(LogCreator.createLog1(ipfs))
        let data = fixture.log

        let log1 = await(Log.fromEntry(ipfs, data.heads, data.heads.length))
        assert.equal(log1.id, data.heads[0].id)
        assert.equal(log1.length, data.heads.length)
        assert.equal(log1.values[0].payload, 'entryC0')
        assert.equal(log1.values[1].payload, 'entryA10')

        let log2 = await(Log.fromEntry(ipfs, data.heads, 4))
        assert.equal(log2.id, data.heads[0].id)
        assert.equal(log2.length, 4)
        assert.equal(log2.values[0].payload, 'entryC0')
        assert.equal(log2.values[1].payload, 'entryA8')
        assert.equal(log2.values[2].payload, 'entryA9')
        assert.equal(log2.values[3].payload, 'entryA10')

        let log3 = await(Log.fromEntry(ipfs, data.heads, 7))
        assert.equal(log3.id, data.heads[0].id)
        assert.equal(log3.length, 7)
        assert.equal(log3.values[0].payload, 'entryB5')
        assert.equal(log3.values[1].payload, 'entryA6')
        assert.equal(log3.values[2].payload, 'entryC0')
        assert.equal(log3.values[3].payload, 'entryA7')
        assert.equal(log3.values[4].payload, 'entryA8')
        assert.equal(log3.values[5].payload, 'entryA9')
        assert.equal(log3.values[6].payload, 'entryA10')
      }))


      it('onProgress callback is fired for each entry', async(() => {
        const log1 = Log.create('A')
        let items1 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          items1.push(n1)
        }

        let i = 0
        let prevDepth = 0
        const callback = (hash, entry, depth) => {
          assert.notEqual(entry, null)
          assert.equal(hash, items1[items1.length - i - 1].hash)
          assert.equal(entry.hash, items1[items1.length - i - 1].hash)
          assert.equal(entry.payload, items1[items1.length - i - 1].payload)
          assert.equal(depth - 1, i)

          i ++
          prevDepth = depth
        }

        const a = await(Log.fromEntry(ipfs, last(items1), -1, [], callback))
      }))

      it('retrieves partial log from an entry hash', async(() => {
        const log1 = Log.create('A')
        const log2 = Log.create('B')
        const log3 = Log.create('C')
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 100
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        // limit to 10 entries
        const a = await(Log.fromEntry(ipfs, last(items1), 10))
        assert.equal(a.length, 10)

        // limit to 42 entries
        const b = await(Log.fromEntry(ipfs, last(items1), 42))
        assert.equal(b.length, 42)
      }))

      it('throws an error if trying to create a log from a hash of an entry', async(() => {
        const log1 = Log.create('A')
        let items1 = []
        const amount = 5
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          items1.push(n1)
        }

        let err
        try {
          await(Log.fromEntry(ipfs, last(items1).hash, 1))
        } catch (e) {
          err = e
        }
        assert.equal(err.message, `'sourceEntries' argument must be an EntrySet, an array of Entry instances or a single Entry`)
      }))

      describe('fetches a log', () => {
        const amount = 100

        let log1
        let log2
        let log3
        let items1 = []
        let items2 = []
        let items3 = []
        let result

        beforeEach(async(() => {
          log1 = Log.create('A')
          log2 = Log.create('B')
          log3 = Log.create('C')
          items1 = []
          items2 = []
          items3 = []
          for(let i = 1; i <= amount; i ++) {
            const prev1 = last(items1)
            const prev2 = last(items2)
            const prev3 = last(items3)
            const n1 = await(Entry.create(ipfs, log1.id, i, 'entryA' + i, [prev1], log1.clock))
            const n2 = await(Entry.create(ipfs, log2.id, i, 'entryB' + i, [prev2, n1], log2.clock))
            const n3 = await(Entry.create(ipfs, log3.id, i, 'entryC' + i, [prev3, n2], log3.clock))
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
        }))

        it('returns all entries - no excluded entries', async(() => {
          const a = await(Log.fromEntry(ipfs, last(items1)))
          assert.equal(a.length, amount)
          assert.equal(a.values[0].hash, items1[0].hash)
        }))

        it('returns all entries - including excluded entries', async(() => {
          // One entry
          const a = await(Log.fromEntry(ipfs, last(items1), -1, [items1[0]]))
          assert.equal(a.length, amount)
          assert.equal(a.values[0].hash, items1[0].hash)

          // All entries
          const b = await(Log.fromEntry(ipfs, last(items1), -1, items1))
          assert.equal(b.length, amount)
          assert.equal(b.values[0].hash, items1[0].hash)
        }))
      })

      it('retrieves full log from an entry hash', async(() => {
        const log1 = Log.create('A')
        const log2 = Log.create('B')
        const log3 = Log.create('C')
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await(Log.fromEntry(ipfs, [last(items1)], amount))
        assert.equal(a.length, amount)

        const b = await(Log.fromEntry(ipfs, [last(items2)], amount * 2))
        assert.equal(b.length, amount * 2)

        const c = await(Log.fromEntry(ipfs, [last(items3)], amount * 3))
        assert.equal(c.length, amount * 3)
      }))

      it('retrieves full log from an entry hash 2', async(() => {
        const log1 = Log.create('A')
        const log2 = Log.create('B')
        const log3 = Log.create('C')
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1]))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1]))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n1, n2]))
          items1.push(n1)
          items2.push(n2)
          items3.push(n3)
        }

        const a = await(Log.fromEntry(ipfs, last(items1), amount))
        assert.equal(a.length, amount)

        const b = await(Log.fromEntry(ipfs, last(items2), amount * 2))
        assert.equal(b.length, amount * 2)

        const c = await(Log.fromEntry(ipfs, last(items3), amount * 3))
        assert.equal(c.length, amount * 3)
      }))

      it('retrieves full log from an entry hash 3', async(() => {
        const log1 = Log.create('A')
        const log2 = Log.create('B')
        const log3 = Log.create('C')
        let items1 = []
        let items2 = []
        let items3 = []
        const amount = 10
        for(let i = 1; i <= amount; i ++) {
          const prev1 = last(items1)
          const prev2 = last(items2)
          const prev3 = last(items3)
          log1.clock.tick()
          log2.clock.tick()
          log3.clock.tick()
          const n1 = await(Entry.create(ipfs, 'A', i, 'entryA' + i, [prev1], log1.clock))
          const n2 = await(Entry.create(ipfs, 'B', i, 'entryB' + i, [prev2, n1], log2.clock))
          const n3 = await(Entry.create(ipfs, 'C', i, 'entryC' + i, [prev3, n1, n2], log3.clock))
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

        const a = await(Log.fromEntry(ipfs, last(items1), amount))
        assert.equal(a.length, amount)

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

        const b = await(Log.fromEntry(ipfs, last(items2), amount * 2))
        assert.equal(b.length, amount * 2)
        assert.deepEqual(itemsInB, b.values.map((e) => e.payload))

        let c = await(Log.fromEntry(ipfs, last(items3), amount * 3))
        c = await(Log.append(ipfs, c, "EOF"))
        assert.equal(c.length, amount * 3 + 1)

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
        assert.deepEqual(c.values.map(e => e.payload), tmp)

        let logX = Log.create('X') // make sure logX comes after A, B and C
        logX = await(Log.append(ipfs, logX, "1"))
        logX = await(Log.append(ipfs, logX, "2"))
        logX = await(Log.append(ipfs, logX, "3"))
        const d = await(Log.fromEntry(ipfs, last(logX.values)))

        const e3 = Log.join(c, c) // idempotent
        const ee = Log.join(e3, e3) // idempotent
        const e4 = Log.join(d, d) // idempotent
        let e1 = Log.join(c, d) // associative
        let e2 = Log.join(d, c) // associative

        assert.equal(e1.toString(), e2.toString())
        assert.equal(e3.toString(), c.toString())
        assert.equal(e4.toString(), d.toString())
        assert.equal(ee.toString(), e3.toString())
        assert.equal(ee.toString(), c.toString())

        e1 = await(Log.append(ipfs, e1, "DONE"))
        e2 = await(Log.append(ipfs, e2, "DONE"))
        const f = await(Log.fromEntry(ipfs, last(e1.values), -1, []))
        const g = await(Log.fromEntry(ipfs, last(e2.values), -1, []))

        assert.equal(f.toString(), bigLogString)
        assert.equal(g.toString(), bigLogString)
      }))

      it('retrieves full log of randomly joined log', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')
        let log3 = Log.create('C')

        for(let i = 1; i <= 5; i ++) {
          log1 = await(Log.append(ipfs, log1, 'entryA' + i))
        }

        for(let i = 1; i <= 5; i ++) {
          log2 = await(Log.append(ipfs, log2, 'entryB' + i))
        }

        log3 = Log.join(log1, log2)

        for(let i = 6; i <= 10; i ++) {
          log1 = await(Log.append(ipfs, log1, 'entryA' + i))
        }

        log1 = Log.join(log1, log3)

        for(let i = 11; i <= 15; i ++) {
          log1 = await(Log.append(ipfs, log1, 'entryA' + i))
        }

        const expectedData = [ 
          'entryA1', 'entryB1', 'entryA2', 'entryB2', 
          'entryA3', 'entryB3', 'entryA4', 'entryB4', 
          'entryA5', 'entryB5',
          'entryA6', 'entryA7', 'entryA8', 'entryA9', 'entryA10',
          'entryA11', 'entryA12', 'entryA13', 'entryA14', 'entryA15' 
        ]

        assert.deepEqual(log1.values.map(e => e.payload), expectedData)
      }))

      it('retrieves randomly joined log deterministically', async(() => {
        let logA = Log.create('A')
        let logB = Log.create('B')
        let log = Log.create('log')

        for(let i = 1; i <= 5; i ++) {
          logA = await(Log.append(ipfs, logA, 'entryA' + i))
        }

        for(let i = 1; i <= 5; i ++) {
          logB = await(Log.append(ipfs, logB, 'entryB' + i))
        }

        let log3 = Log.join(logA, logB, -1, logA.id)

        for(let i = 6; i <= 10; i ++) {
          logA = await(Log.append(ipfs, logA, 'entryA' + i))
        }

        log = Log.join(log, log3, -1, 'X')
        log = await(Log.append(ipfs, log, 'entryC0'))
        log = Log.join(logA, log, 16, logA.id)

        const expectedData = [ 
          'entryA1', 'entryB1', 'entryA2', 'entryB2', 
          'entryA3', 'entryB3', 'entryA4', 'entryB4', 
          'entryA5', 'entryB5',
          'entryA6',
          'entryC0', 'entryA7', 'entryA8', 'entryA9', 'entryA10',
        ]

        assert.deepEqual(log.values.map(e => e.payload), expectedData)
      }))

      it('sorts', async(() => {
        let testLog = await(LogCreator.createLog1(ipfs))
        let log = testLog.log
        const expectedData = testLog.expectedData

        const expectedData2 = [ 
          'entryA1', 'entryB1', 'entryA2', 'entryB2',
          'entryA3', 'entryB3', 'entryA4', 'entryB4', 
          'entryA5', 'entryB5',
          'entryA6', 'entryA7', 'entryA8', 'entryA9', 'entryA10',            
        ]

        const expectedData3 = [ 
          'entryA1', 'entryB1', 'entryA2', 'entryB2',
          'entryA3', 'entryB3', 'entryA4', 'entryB4',
          'entryA5', 'entryB5', 'entryA6', 'entryC0', 
          'entryA7', 'entryA8', 'entryA9',
        ]

        const expectedData4 = [ 
          'entryA1', 'entryB1', 'entryA2', 'entryB2',
          'entryA3', 'entryB3', 'entryA4', 'entryB4',
          'entryA5', 'entryA6', 'entryC0', 'entryA7', 
          'entryA8', 'entryA9', 'entryA10',
        ]

        let fetchOrder = EntrySet.sort(log.values.slice())
        assert.deepEqual(fetchOrder.map(e => e.payload), expectedData)

        let reverseOrder = EntrySet.sort(log.values.slice().reverse())
        assert.deepEqual(fetchOrder, reverseOrder)

        let hashOrder = EntrySet.sort(log.values.slice().sort((a, b) => a.hash > b.hash))
        assert.deepEqual(fetchOrder, hashOrder)

        let randomOrder2 = EntrySet.sort(log.values.slice().sort((a, b) => 0.5 - Math.random()))
        assert.deepEqual(fetchOrder, randomOrder2)

        // partial data
        let partialLog = EntrySet.sort(log.values.filter(e => e.payload !== 'entryC0'))
        assert.deepEqual(partialLog.map(e => e.payload), expectedData2)

        let partialLog2 = EntrySet.sort(log.values.filter(e => e.payload !== 'entryA10'))
        assert.deepEqual(partialLog2.map(e => e.payload), expectedData3)

        let partialLog3 = EntrySet.sort(log.values.filter(e => e.payload !== 'entryB5'))
        assert.deepEqual(partialLog3.map(e => e.payload), expectedData4)
      }))

      it('sorts deterministically from random order', async(() => {
        let testLog = await(LogCreator.createLog1(ipfs))
        let log = testLog.log
        const expectedData = testLog.expectedData

        let fetchOrder = EntrySet.sort(log.values.slice())
        assert.deepEqual(fetchOrder.map(e => e.payload), expectedData)

        let randomOrder
        for (let i = 0; i < 1000; i ++) {
          const sorted = log.values.slice().sort((a, b) => 0.5 - Math.random())
          randomOrder = EntrySet.sort(sorted)
          assert.deepEqual(randomOrder.map(e => e.payload), expectedData)          
        }
      }))

      it('sorts entries correctly', async(() => {
        let testLog = await(LogCreator.createLog100_2(ipfs))
        let log = testLog.log
        const expectedData = testLog.expectedData
        assert.deepEqual(log.values.map(e => e.payload), expectedData)
      }))

      it('retrieves partially joined log deterministically', async(() => {
        let logA = Log.create('A')
        let logB = Log.create('B')
        let log = Log.create('log')

        for(let i = 1; i <= 5; i ++) {
          logA = await(Log.append(ipfs, logA, 'entryA' + i))
        }

        for(let i = 1; i <= 5; i ++) {
          logB = await(Log.append(ipfs, logB, 'entryB' + i))
        }

        let log3 = Log.join(logA, logB)

        for(let i = 6; i <= 10; i ++) {
          logA = await(Log.append(ipfs, logA, 'entryA' + i))
        }

        log = Log.join(log, log3, -1, 'X')
        log = await(Log.append(ipfs, log, 'entryC0'))

        log = Log.join(logA, log, -1)

        const mh = await(Log.toMultihash(ipfs, log))

        // First 5
        let res = await(Log.fromMultihash(ipfs, mh, 5))

        const first5 = [ 
          'entryA5', 'entryB5', 'entryC0', 'entryA9', 'entryA10',
        ]

        assert.deepEqual(res.values.map(e => e.payload), first5)

        // First 11
        res = await(Log.fromMultihash(ipfs, mh, 11))

        const first11 = [ 
          'entryA3', 'entryB3', 'entryA4', 'entryB4', 
          'entryA5', 'entryB5', 
          'entryC0',
          'entryA7', 'entryA8', 'entryA9', 'entryA10',
        ]

        assert.deepEqual(res.values.map(e => e.payload), first11)

        // All but one
        res = await(Log.fromMultihash(ipfs, mh, 16 - 1))

        const all = [ 
          'entryA1', /* excl */ 'entryA2', 'entryB2', 'entryA3', 'entryB3',
          'entryA4', 'entryB4', 'entryA5', 'entryB5',
          'entryA6', 
          'entryC0', 'entryA7', 'entryA8', 'entryA9', 'entryA10',
        ]

        assert.deepEqual(res.values.map(e => e.payload), all)
      }))

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          Log.fromEntry()
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })

      it('throws an error if ipfs is not defined', () => {
        let err
        try {
          await(Log.fromEntry())
        } catch (e) {
          err = e
        }
        assert.notEqual(err, null)
        assert.equal(err.message, 'Ipfs instance not defined')
      })
    })

    describe('heads', () => {
      it('finds one head after one entry', async(() => {
        let log1 = Log.create('A')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        assert.equal(log1.heads.length, 1)
      }))

      it('finds one head after two entries', async(() => {
        let log1 = Log.create('A')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        assert.equal(log1.heads.length, 1)
      }))

      it('log contains the head entry', async(() => {
        let log1 = Log.create('A')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        assert.deepEqual(log1.get(log1.heads[0].hash), log1.heads[0])
      }))

      it('finds head after a join and append', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))

        log2 = Log.join(log1, log2)
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        const expectedHead = last(log2.values)

        assert.equal(log2.heads.length, 1)
        assert.deepEqual(log2.heads[0].hash, expectedHead.hash)
      }))

      it('finds two heads after a join', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        const expectedHead1 = last(log1.values)

        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        const expectedHead2 = last(log2.values)

        log1 = Log.join(log1, log2)

        const heads = log1.heads
        assert.equal(heads.length, 2)
        assert.equal(heads[0].hash, expectedHead1.hash)
        assert.equal(heads[1].hash, expectedHead2.hash)
      }))

      it('finds two heads after two joins', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))

        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))

        log1 = Log.join(log1, log2)

        log2 = await(Log.append(ipfs, log2, "helloB3"))

        log1 = await(Log.append(ipfs, log1, "helloA3"))
        log1 = await(Log.append(ipfs, log1, "helloA4"))
        const expectedHead2 = last(log2.values)
        const expectedHead1 = last(log1.values)

        log1 = Log.join(log1, log2)

        const heads = log1.heads
        assert.equal(heads.length, 2)
        assert.equal(heads[0].hash, expectedHead1.hash)
        assert.equal(heads[1].hash, expectedHead2.hash)
      }))

      it('finds two heads after three joins', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')
        let log3 = Log.create('C')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(log1, log2)
        log1 = await(Log.append(ipfs, log1, "helloA3"))
        log1 = await(Log.append(ipfs, log1, "helloA4"))
        const expectedHead1 = last(log1.values)
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        log2 = Log.join(log2, log3)
        log2 = await(Log.append(ipfs, log2, "helloB3"))
        const expectedHead2 = last(log2.values)
        log1 = Log.join(log1, log2)

        const heads = log1.heads
        assert.equal(heads.length, 2)
        assert.equal(heads[0].hash, expectedHead1.hash)
        assert.equal(heads[1].hash, expectedHead2.hash)
      }))

      it('finds three heads after three joins', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')
        let log3 = Log.create('C')

        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log1 = Log.join(log1, log2)
        log1 = await(Log.append(ipfs, log1, "helloA3"))
        log1 = await(Log.append(ipfs, log1, "helloA4"))
        const expectedHead1 = last(log1.values)
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log2 = await(Log.append(ipfs, log2, "helloB3"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))
        const expectedHead2 = last(log2.values)
        const expectedHead3 = last(log3.values)
        log1 = Log.join(log1, log2)
        log1 = Log.join(log1, log3)

        const heads = log1.heads
        assert.equal(heads.length, 3)
        assert.deepEqual(heads[0].hash, expectedHead1.hash)
        assert.deepEqual(heads[1].hash, expectedHead2.hash)
        assert.deepEqual(heads[2].hash, expectedHead3.hash)
      }))
    })

    describe('tails', () => {
      it('returns a tail', async(() => {
        let log1 = Log.create('A')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        assert.equal(log1.tails.length, 1)
      }))

      it('tail is a Entry', async(() => {
        let log1 = Log.create('A')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        assert.equal(Entry.isEntry(log1.tails[0]), true)
      }))

      it('returns tail entries', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        const log3 = Log.join(log1, log2)
        assert.equal(log3.tails.length, 2)
        assert.equal(Entry.isEntry(log3.tails[0]), true)
        assert.equal(Entry.isEntry(log3.tails[1]), true)
      }))

      it('returns tail hashes', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        const log3 = Log.join(log1, log2, 2)
        assert.equal(log3.tailHashes.length, 2)
      }))

      it('returns no tail hashes if all entries point to empty nexts', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        const log3 = Log.join(log1, log2)
        assert.equal(log3.tailHashes.length, 0)
      }))

      it('returns tails after loading a partial log', async(() => {
        let log1 = Log.create('A')
        let log2 = Log.create('B')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        const log3 = Log.join(log1, log2)
        const log4 = await(Log.fromEntry(ipfs, log3.heads, 2))
        assert.equal(log4.length, 2)
        assert.equal(log4.tails.length, 2)
        assert.equal(log4.tails[0].hash, log4.values[0].hash)
        assert.equal(log4.tails[1].hash, log4.values[1].hash)
      }))

      it('returns tails sorted by id', async(() => {
        let log1 = Log.create('X')
        let log2 = Log.create('B')
        let log3 = Log.create('A')
        log1 = await(Log.append(ipfs, log1, "helloX1"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log3 = await(Log.append(ipfs, log3, "helloA1"))
        let log4 = Log.join(log1, log2)
        log4 = Log.join(log4, log3)
        assert.equal(log4.tails.length, 3)
        assert.equal(log4.tails[0].id, 'A')
        assert.equal(log4.tails[1].id, 'B')
        assert.equal(log4.tails[2].id, 'X')
      }))
    })

    describe('is a CRDT', () => {
      let log1, log2, log3

      beforeEach(async(() => {
        log1 = Log.create('A')
        log2 = Log.create('B')
        log3 = Log.create('C')
      }))

      it('join is associative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))

        // a + (b + c)
        const logA1 = Log.join(log2, log3)
        const logA2 = Log.join(log1, logA1)

        const res1 = logA2.values//.map((e) => e.hash).join(",")

        log1 = Log.create('A')
        log2 = Log.create('B')
        log3 = Log.create('C')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))

        // (a + b) + c
        const logB1 = Log.join(log1, log2)
        const logB2 = Log.join(logB1, log3)

        const res2 = logB2.values//.map((e) => e.hash).join(",")

        // associativity: a + (b + c) == (a + b) + c
        const len = 6//(46 + 1) * 6- 1 // 46 == ipfs hash, +1 == .join(","), * 4 == number of items, -1 == last item doesn't get a ',' from .join
        assert.equal(res1.length, len)
        assert.equal(res2.length, len)
        assert.deepEqual(res1, res2)
      }))

      it('join is commutative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))

        // b + a
        const log3 = Log.join(log2, log1)
        const res1 = log3.values//.map((e) => e.hash).join(",")

        log1 = Log.create('A')
        log2 = Log.create('B')
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))

        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))

        // a + b
        const log4 = Log.join(log1, log2)
        const res2 = log4.values//.map((e) => e.hash).join(",")

        // commutativity: a + b == b + a
        // const len = (46 + 1) * 4 - 1 // 46 == ipfs hash length, +1 == .join(","), * 4 == number of items, -1 == last item doesn't get a ',' from .join
        assert.equal(res1.length, 4)
        assert.equal(res2.length, 4)
        assert.deepEqual(res1, res2)
      }))

      it('multiple joins are commutative', async(() => {
        log1 = await(Log.append(ipfs, log1, "helloA1"))
        log1 = await(Log.append(ipfs, log1, "helloA2"))
        log2 = await(Log.append(ipfs, log2, "helloB1"))
        log2 = await(Log.append(ipfs, log2, "helloB2"))
        log3 = await(Log.append(ipfs, log3, "helloC1"))
        log3 = await(Log.append(ipfs, log3, "helloC2"))

        // b + a == a + b
        const logA1 = Log.join(log2, log1)
        const logA2 = Log.join(log1, log2)
        assert.equal(logA1.toString(), logA2.toString())

        // a + b == b + a
        const logB1 = Log.join(log1, log2)
        const logB2 = Log.join(log2, log1)
        assert.equal(logB1.toString(), logB2.toString())

        // a + c == c + a
        const logC1 = Log.join(log1, log3)
        const logC2 = Log.join(log3, log1)
        assert.equal(logC1.toString(), logC2.toString())

        // c + b == b + c
        const logD1 = Log.join(log3, log2)
        const logD2 = Log.join(log2, log3)
        assert.equal(logD1.toString(), logD2.toString())

        // a + b + c == c + b + a
        let logLeft = Log.join(log1, log2)
        logLeft = Log.join(logLeft, log3)
        let logRight = Log.join(log3, log2)
        logRight = Log.join(logRight, log1)
        assert.equal(logLeft.toString(), logRight.toString())
      }))

      it('join is idempotent', async(() => {
        let logA = Log.create('A')
        let logB = Log.create('B')
        logA = await(Log.append(ipfs, logA, "helloA1"))
        logA = await(Log.append(ipfs, logA, "helloA2"))
        logA = await(Log.append(ipfs, logA, "helloA3"))
        logB = await(Log.append(ipfs, logB, "helloA1"))
        logB = await(Log.append(ipfs, logB, "helloA2"))
        logB = await(Log.append(ipfs, logB, "helloA3"))

        // idempotence: a + a = a
        const log = Log.join(logA, logA)

        assert.equal(log.length, 3)
      }))
    })
  })

})
