'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const Log = require('../src/log')
const IdentityProvider = require('orbit-db-identity-provider')

// Test utils
const {
  config,
  testAPIs,
  startIpfs,
  stopIpfs,
  getIpfsPeerId,
  waitForPeers,
  MemStore
} = require('./utils')

Object.keys(testAPIs).forEach((IPFS) => {
  describe('ipfs-log - Replication (' + IPFS + ')', function () {
    this.timeout(config.timeout)

    let ipfs1, ipfs2, id1, id2, testIdentity, testIdentity2

    const { identityKeysPath, signingKeysPath } = config
    const ipfsConfig1 = Object.assign({}, config.daemon1, {
      repo: config.daemon1.repo + new Date().getTime()
    })
    const ipfsConfig2 = Object.assign({}, config.daemon2, {
      repo: config.daemon2.repo + new Date().getTime()
    })

    before(async () => {
      rmrf.sync(ipfsConfig1.repo)
      rmrf.sync(ipfsConfig2.repo)

      // Start two IPFS instances
      ipfs1 = await startIpfs(IPFS, ipfsConfig1)
      ipfs2 = await startIpfs(IPFS, ipfsConfig2)

      // Get the peer IDs
      id1 = await getIpfsPeerId(ipfs1)
      id2 = await getIpfsPeerId(ipfs2)

      // Use mem-store for faster testing (no disk IO)
      const memstore = new MemStore()
      ipfs1.dag.put = memstore.put.bind(memstore)
      ipfs1.dag.get = memstore.get.bind(memstore)
      ipfs2.dag.put = memstore.put.bind(memstore)
      ipfs2.dag.get = memstore.get.bind(memstore)

      // Create an identity for each peers
      testIdentity = await IdentityProvider.createIdentity({ id: 'userA', identityKeysPath, signingKeysPath })
      testIdentity2 = await IdentityProvider.createIdentity({ id: 'userB', identityKeysPath, signingKeysPath })
    })

    after(async () => {
      await stopIpfs(ipfs1)
      await stopIpfs(ipfs2)
      rmrf.sync(ipfsConfig1.repo)
      rmrf.sync(ipfsConfig2.repo)
    })

    describe('replicates logs deterministically', function () {
      const amount = 128 + 1
      const channel = 'XXX'
      const logId = 'A'

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
        const log = await Log.fromCID(ipfs1, testIdentity, message.data.toString(), -1)
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
        const log = await Log.fromCID(ipfs2, testIdentity2, message.data.toString(), -1, null)
        await log2.join(log)
        processing--
      }

      beforeEach(async () => {
        log1 = new Log(ipfs1, testIdentity, { logId })
        log2 = new Log(ipfs2, testIdentity2, { logId })
        input1 = new Log(ipfs1, testIdentity, { logId })
        input2 = new Log(ipfs2, testIdentity2, { logId })
        await ipfs1.pubsub.subscribe(channel, handleMessage)
        await ipfs2.pubsub.subscribe(channel, handleMessage2)
      })

      it('replicates logs', async () => {
        await waitForPeers(ipfs1, [id2], channel)

        for (let i = 1; i <= amount; i++) {
          await input1.append('A' + i)
          await input2.append('B' + i)
          const cid1 = await input1.toCID()
          const cid2 = await input2.toCID()
          await ipfs1.pubsub.publish(channel, Buffer.from(cid1))
          await ipfs2.pubsub.publish(channel, Buffer.from(cid2))
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
        await whileProcessingMessages(config.timeout)

        let result = new Log(ipfs1, testIdentity, { logId })
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
      })
    })
  })
})
