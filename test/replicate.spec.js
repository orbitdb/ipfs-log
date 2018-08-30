'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const config = require('./config/ipfs-daemon.config')
const Log = require('../src/log.js')
const MemStore = require('./utils/mem-store')
const { AccessController, IdentityProvider, Keystore } = Log

const apis = [require('ipfs')]

const repoConf = {
  storageBackends: {
    blocks: DatastoreLevel
  }
}

const channel = 'XXX'

// Shared database name
const waitForPeers = (ipfs, channel) => {
  return new Promise((resolve, reject) => {
    console.log('Waiting for peers...')
    const interval = setInterval(() => {
      ipfs.pubsub.peers(channel)
        .then((peers) => {
          if (peers.length > 0) {
            console.log('Found peers, running tests...')
            clearInterval(interval)
            resolve()
          }
        })
        .catch(reject)
    }, 200)
  })
}

apis.forEach((IPFS) => {
  describe('ipfs-log - Replication', function () {
    this.timeout(40000)

    let ipfs1, ipfs2, id1, id2, testIdentity, testIdentity2

    const testKeysPath = './test/fixtures/keys'
    const keystore = Keystore.create(testKeysPath)
    const identitySignerFn = async (id, data) => {
      const key = await keystore.getKey(id)
      return keystore.sign(key, data)
    }
    const testACL = new AccessController()

    before(function (done) {
      rmrf.sync(config.daemon1.repo)
      rmrf.sync(config.daemon2.repo)

      config.damon1 = Object.assign({}, config.daemon1, { repo: new IPFSRepo(config.daemon1.repo, repoConf) })
      ipfs1 = new IPFS(config.daemon1)
      ipfs1.on('error', done)
      ipfs1.on('ready', () => {
        ipfs1.id()
          .then((id) => (id1 = id.id))
          .then(() => {
            config.damon2 = Object.assign({}, config.daemon2, { repo: new IPFSRepo(config.daemon2.repo, repoConf) })
            ipfs2 = new IPFS(config.daemon2)
            ipfs2.on('error', done)
            ipfs2.on('ready', () => {
              ipfs2.id()
                .then((id) => (id2 = id.id))
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

                  testIdentity = await IdentityProvider.createIdentity(keystore, 'userA', identitySignerFn)
                  testIdentity2 = await IdentityProvider.createIdentity(keystore, 'userB', identitySignerFn)

                  done()
                })
            })
          })
      })
    })

    after(async () => {
      if (ipfs1) {
        await ipfs1.stop()
      }

      if (ipfs2) {
        await ipfs2.stop()
      }
    })

    describe('replicates logs deterministically', function () {
      const amount = 128 + 1

      let log1, log2, input1, input2
      let buffer1 = []
      let buffer2 = []
      let processing = 0

      const handleMessage = async (message) => {
        if (id1 === message.from) {
          return
        }
        buffer1.push(message.data.toString())
        processing++
        process.stdout.write('\r')
        process.stdout.write(`> Buffer1: ${buffer1.length} - Buffer2: ${buffer2.length}`)
        const log = await Log.fromMultihash(ipfs1, testACL, testIdentity, message.data.toString(), -1)
        await log1.join(log)
        processing--
      }

      const handleMessage2 = async (message) => {
        if (id2 === message.from) {
          return
        }
        buffer2.push(message.data.toString())
        processing++
        process.stdout.write('\r')
        process.stdout.write(`> Buffer1: ${buffer1.length} - Buffer2: ${buffer2.length}`)
        const log = await Log.fromMultihash(ipfs2, testACL, testIdentity2, message.data.toString(), -1, null)
        await log2.join(log)
        processing--
      }

      beforeEach((done) => {
        log1 = new Log(ipfs1, testACL, testIdentity, 'A')
        log2 = new Log(ipfs2, testACL, testIdentity2, 'A')
        input1 = new Log(ipfs1, testACL, testIdentity, 'A')
        input2 = new Log(ipfs2, testACL, testIdentity2, 'A')
        ipfs1.pubsub.subscribe(channel, handleMessage, (err) => {
          if (err) {
            return done(err)
          }
          ipfs2.pubsub.subscribe(channel, handleMessage2, (err) => {
            if (err) {
              done(err)
            } else {
              done()
            }
          })
        })
      })

      it('replicates logs', (done) => {
        waitForPeers(ipfs1, channel)
          .then(async () => {
            for (let i = 1; i <= amount; i++) {
              await input1.append('A' + i)
              await input2.append('B' + i)
              const mh1 = await input1.toMultihash()
              const mh2 = await input2.toMultihash()
              await ipfs1.pubsub.publish(channel, Buffer.from(mh1))
              await ipfs2.pubsub.publish(channel, Buffer.from(mh2))
            }

            console.log('\nAll messages sent')

            const whileProcessingMessages = (timeoutMs) => {
              return new Promise((resolve, reject) => {
                setTimeout(() => reject(new Error('timeout')), timeoutMs)
                const timer = setInterval(() => {
                  if (buffer1.length + buffer2.length === amount * 2 &&
                      processing === 0) {
                    console.log('\nAll messages received')
                    clearInterval(timer)
                    resolve()
                  }
                }, 200)
              })
            }

            console.log('Waiting for all to process')
            try {
              const timeout = 30000
              await whileProcessingMessages(timeout)

              let result = new Log(ipfs1, testACL, testIdentity, 'A')
              await result.join(log1)
              await result.join(log2)

              assert.strictEqual(buffer1.length, amount)
              assert.strictEqual(buffer2.length, amount)
              assert.strictEqual(result.length, amount * 2)
              assert.strictEqual(log1.length, amount)
              assert.strictEqual(log2.length, amount)
              assert.strictEqual(result.values[0].payload, 'A1')
              assert.strictEqual(result.values[1].payload, 'B1')
              assert.strictEqual(result.values[2].payload, 'A2')
              assert.strictEqual(result.values[3].payload, 'B2')
              assert.strictEqual(result.values[99].payload, 'B50')
              assert.strictEqual(result.values[100].payload, 'A51')
              assert.strictEqual(result.values[198].payload, 'A100')
              assert.strictEqual(result.values[199].payload, 'B100')
              done()
            } catch (e) {
              done(e)
            }
          })
          .catch(done)
      })
    })
  })
})
