'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const config = require('./config/ipfs-daemon.config')
const Log = require('../src/log.js')
const MemStore = require('./utils/mem-store')
const getTestEntryValidator = require('./utils/test-entry-validator')

const apis = [require('ipfs')]

const repoConf = {
  storageBackends: {
    blocks: DatastoreLevel,
  },
}

const channel = 'XXX'

// Shared database name
const waitForPeers = (ipfs, channel) => {
  return new Promise((resolve, reject) => {
    console.log("Waiting for peers...")
    const interval = setInterval(() => {
      ipfs.pubsub.peers(channel)
        .then((peers) => {
          if (peers.length > 0) {
            console.log("Found peers, running tests...")
            clearInterval(interval)
            resolve()
          }
        })
        .catch(reject)
    }, 200)
  })
}

apis.forEach((IPFS) => {

  describe('ipfs-log - Replication', function() {
    this.timeout(40000)

    let ipfs1, ipfs2, client1, client2, db1, db2, id1, id2

    before(function (done) {
      rmrf.sync(config.daemon1.repo)
      rmrf.sync(config.daemon2.repo)

      config.damon1 = Object.assign({}, config.daemon1, { repo: new IPFSRepo(config.daemon1.repo, repoConf) })
      ipfs1 = new IPFS(config.daemon1)
      ipfs1.on('error', done)
      ipfs1.on('ready', () => {
        ipfs1.id()
          .then((id) => id1 = id.id)
          .then(() => {
            config.damon2 = Object.assign({}, config.daemon2, { repo: new IPFSRepo(config.daemon2.repo, repoConf) })
            ipfs2 = new IPFS(config.daemon2)
            ipfs2.on('error', done)
            ipfs2.on('ready', () => {
              ipfs2.id()
                .then((id) => id2 = id.id)
                .then(async () => {

                  // Use memory store for quicker tests
                  const memstore = new MemStore()
                  ipfs1.object.put = memstore.put.bind(memstore)
                  ipfs1.object.get = memstore.get.bind(memstore)
                  ipfs2.object.put = memstore.put.bind(memstore)
                  ipfs2.object.get = memstore.get.bind(memstore)

                  // Connect the peers manually to speed up test times
                  await ipfs2.swarm.connect(ipfs1._peerInfo.multiaddrs._multiaddrs[0].toString())
                  await ipfs1.swarm.connect(ipfs2._peerInfo.multiaddrs._multiaddrs[0].toString())
                  done()
                })
            })
          })
      })
    })

    after(async () => {
      if (ipfs1)
        await ipfs1.stop()

      if (ipfs2)
        await ipfs2.stop()
    })

    describe('replicates logs deterministically', function() {
      const amount = 128 + 1

      let log1, log2, input1, input2
      let buffer1 = []
      let buffer2 = []
      let processing = 0

      const handleMessage = async (message) => {
        if (id1 === message.from)
          return
        buffer1.push(message.data.toString())
        processing ++
        const exclude = log1.values.map((e) => e.hash)
        process.stdout.write('\r')
        process.stdout.write(`> Buffer1: ${buffer1.length} - Buffer2: ${buffer2.length}`)
        const log = await Log.fromMultihash(ipfs1, message.data.toString())
        await log1.join(log)
        processing --
      }

      const handleMessage2 = async (message) => {
        if (id2 === message.from)
          return
        buffer2.push(message.data.toString())
        processing ++
        process.stdout.write('\r')
        process.stdout.write(`> Buffer1: ${buffer1.length} - Buffer2: ${buffer2.length}`)
        const exclude = log2.values.map((e) => e.hash)
        const log = await Log.fromMultihash(ipfs2, message.data.toString())
        await log2.join(log)
        processing --
      }

      beforeEach((done) => {
        log1 = new Log(ipfs1, 'A', null, null, null, getTestEntryValidator('peerA'))
        log2 = new Log(ipfs2, 'A', null, null, null, getTestEntryValidator('peerB'))
        input1 = new Log(ipfs1, 'A', null, null, null, getTestEntryValidator('peerA'))
        input2 = new Log(ipfs2, 'A', null, null, null, getTestEntryValidator('peerB'))
        ipfs1.pubsub.subscribe(channel, handleMessage, (err) => {
          if (err)
            return done(err)
          ipfs2.pubsub.subscribe(channel, handleMessage2, (err) => {
            if (err)
              done(err)
            else
              done()
          })
        })
      })

      it('replicates logs', (done) => {
        waitForPeers(ipfs1, channel)
          .then(async () => {
            for(let i = 1; i <= amount; i ++) {
              await input1.append("A" + i)
              await input2.append("B" + i)
              const mh1 = await input1.toMultihash()
              const mh2 = await input2.toMultihash()
              await ipfs1.pubsub.publish(channel, Buffer.from(mh1))
              await ipfs2.pubsub.publish(channel, Buffer.from(mh2))
            }

            console.log("\nAll messages sent")

            const whileProcessingMessages = (timeoutMs) => {
              return new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('timeout')), timeoutMs)
                const timer = setInterval(() => {
                  if (buffer1.length + buffer2.length === amount * 2
                      && processing === 0) {
                    console.log("\nAll messages received")
                    clearInterval(timer)
                    resolve()
                  }
                }, 200)
              })
            }

            console.log("Waiting for all to process")
            try {
              const timeout = 30000
              await whileProcessingMessages(timeout)

              let result = new Log(ipfs1, 'A', null, null, null, getTestEntryValidator('peerA'))
              await result.join(log1)
              await result.join(log2)

              assert.equal(buffer1.length, amount)
              assert.equal(buffer2.length, amount)
              assert.equal(result.length, amount * 2)
              assert.equal(log1.length, amount)
              assert.equal(log2.length, amount)
              assert.equal(result.values[0].payload, 'A1')
              assert.equal(result.values[1].payload, 'B1')
              assert.equal(result.values[2].payload, 'A2')
              assert.equal(result.values[3].payload, 'B2')
              assert.equal(result.values[99].payload, 'B50')
              assert.equal(result.values[100].payload, 'A51')
              assert.equal(result.values[198].payload, 'A100')
              assert.equal(result.values[199].payload, 'B100')
              done()
            } catch(e) {
              done(e)
            }

          })
          .catch(done)
      })
    })
  })
})
