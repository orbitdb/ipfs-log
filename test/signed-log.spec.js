'use strict'

const assert = require('assert')
const rmrf = require('rimraf')
const IPFSRepo = require('ipfs-repo')
const DatastoreLevel = require('datastore-level')
const Keystore = require('orbit-db-keystore')
const Log = require('../src/log.js')

const apis = [require('ipfs')]

const dataDir = './ipfs/tests/log'

const repoConf = {
  storageBackends: {
    blocks: DatastoreLevel,
  },
}

const ipfsConf = {
  repo: new IPFSRepo(dataDir, repoConf),
  EXPERIMENTAL: {
    pubsub: true,
    dht: false,
    sharding: false,
  },
}

let ipfs, key1, key2, key3

const last = (arr) => {
  return arr[arr.length - 1]
}

apis.forEach((IPFS) => {
  describe('Signed Log', function() {
    this.timeout(10000)

    const keystore = Keystore.create('./test/fixtures/keystore')

    before((done) => {
      rmrf.sync(dataDir)
      key1 = keystore.getKey('A')
      key2 = keystore.getKey('B')
      key3 = keystore.getKey('C')
      ipfs = new IPFS(ipfsConf)
      ipfs.keystore = keystore
      ipfs.on('error', done)
      ipfs.on('ready', () => done())
    })

    after(async () => {
      if (ipfs)
        await ipfs.stop()
    })

    it('creates a signed log', () => {
      const log = new Log(ipfs, 'A', null, null, null, key1)
      assert.notEqual(log.id, null)
      assert.deepEqual(log._key, key1)
      assert.deepEqual(log._keys, [])
    })

    it('takes an array of write-access public keys as an argument', () => {
      const log = new Log(ipfs, 'A', null, null, null, key1, [key2.getPublic('hex'), key3.getPublic('hex')])
      assert.notEqual(log.id, null)
      assert.deepEqual(log._key, key1)
      assert.deepEqual(log._keys, [key2.getPublic('hex'), key3.getPublic('hex')])
    })

    it('takes a single write-access public key as an argument', () => {
      const log = new Log(ipfs, 'A', null, null, null, key1, key2.getPublic('hex'))
      assert.notEqual(log.id, null)
      assert.deepEqual(log._key, key1)
      assert.deepEqual(log._keys, [key2.getPublic('hex')])
    })

    it('entries contain a signature and a public signing key', async () => {
      const log = new Log(ipfs, 'A', null, null, null, key1, [key1.getPublic('hex')])
      await log.append('one')
      assert.notEqual(log.values[0].sig, null)
      assert.equal(log.values[0].key, key1.getPublic('hex'))
    })

    it('doesn\'t sign entries when key is not defined', async () => {
      const log = new Log(ipfs, 'A')
      await log.append('one')
      assert.equal(log.values[0].sig, null)
      assert.equal(log.values[0].key, null)
    })

    it('allows only the owner to write when write-access keys are defined', async () => {
      const log1 = new Log(ipfs, 'A', null, null, null, key1, [key1.getPublic('hex')])
      const log2 = new Log(ipfs, 'B', null, null, null, key2)

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }
      assert.equal(err, 'Error: Not allowed to write')
    })

    it('allows only the specified keys to write when write-access keys are defined', async () => {
      const log1 = new Log(ipfs, 'A', null, null, null, key1, [key1.getPublic('hex'), key2.getPublic('hex')])
      const log2 = new Log(ipfs, 'A', null, null, null, key2, [key1.getPublic('hex'), key2.getPublic('hex')])

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
        throw e
      }
      assert.equal(err, null)
      assert.equal(log1.id, 'A')
      assert.equal(log1.values.length, 2)
      assert.equal(log1.values[0].payload, 'one')
      assert.equal(log1.values[1].payload, 'two')
    })

    it('allows others than the owner to write', async () => {
      const log1 = new Log(ipfs, 'A', null, null, null, key1, [key2.getPublic('hex')])
      const log2 = new Log(ipfs, 'A', null, null, null, key2, [key2.getPublic('hex')])

      let err
      try {
        await log2.append('one')
        await log2.append('two')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
        throw e
      }
      assert.equal(err, null)
      assert.equal(log1.id, 'A')
      assert.equal(log1.values.length, 2)
      assert.equal(log1.values[0].payload, 'one')
      assert.equal(log1.values[1].payload, 'two')
    })

    it('allows anyone to write', async () => {
      const log1 = new Log(ipfs, 'A', null, null, null, key1, ['*'])
      const log2 = new Log(ipfs, 'A', null, null, null, key2, ['*'])

      let err
      try {
        await log2.append('one')
        await log2.append('two')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
        throw e
      }
      assert.equal(err, null)
      assert.equal(log1.id, 'A')
      assert.equal(log1.values.length, 2)
      assert.equal(log1.values[0].payload, 'one')
      assert.equal(log1.values[1].payload, 'two')
    })

    it('doesn\'t join logs with different IDs ', async () => {
      const log1 = new Log(ipfs, 'A', null, null, null, key1, ['*'])
      const log2 = new Log(ipfs, 'B', null, null, null, key1, ['*'])

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        await log2.append('three')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
        throw e
      }
      assert.equal(err, null)
      assert.equal(log1.id, 'A')
      assert.equal(log1.values.length, 1)
      assert.equal(log1.values[0].payload, 'one')
    })

    it('doesn\'t allows the owner to write if write-keys defines non-owner key', async () => {
      const log1 = new Log(ipfs, 'A', null, null, null, key1, [key2.getPublic('hex')])

      let err
      try {
        await log1.append('one')
      } catch (e) {
        err = e.toString()
      }
      assert.equal(err, 'Error: Not allowed to write')
    })

    it('allows nobody to write when write-access keys are not defined', async () => {
      const log1 = new Log(ipfs, 'A', null, null, null, key1, [])

      let err
      try {
        await log1.append('one')
      } catch (e) {
        err = e.toString()
      }
      assert.equal(err.toString(), 'Error: Not allowed to write')
    })

    it('throws an error if log is signed but trying to merge with an entry that doesn\'t have public signing key', async () => {
      const log1 = new Log(ipfs, 'A', null, null, null, key1, [key1.getPublic('hex'), key2.getPublic('hex')])
      const log2 = new Log(ipfs, 'A', null, null, null, key2, [key1.getPublic('hex'), key2.getPublic('hex')])

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        delete log2.values[0].key
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }
      assert.equal(err, 'Error: Entry doesn\'t have a public key')
    })

    it('throws an error if log is signed but trying to merge an entry that doesn\'t have a signature', async () => {
      const log1 = new Log(ipfs, 'A', null, null, null, key1, [key1.getPublic('hex'), key2.getPublic('hex')])
      const log2 = new Log(ipfs, 'A', null, null, null, key2, [key1.getPublic('hex'), key2.getPublic('hex')])

      let err
      try {
        await log1.append('one')
        await log2.append('two')
        delete log2.values[0].sig
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }
      assert.equal(err, 'Error: Entry doesn\'t have a signature')
    })

    it('throws an error if log is signed but the signature doesn\'t verify', async () => {

      const replaceAt = (str, index, replacement) => {
        return str.substr(0, index) + replacement+ str.substr(index + replacement.length)
      }

      const log1 = new Log(ipfs, 'A', null, null, null, key1, [key1.getPublic('hex'), key2.getPublic('hex')])
      const log2 = new Log(ipfs, 'A', null, null, null, key2, [key1.getPublic('hex'), key2.getPublic('hex')])
      let err

      try {
        await log1.append('one')
        await log2.append('two')
        log2.values[0].sig = replaceAt(log2.values[0].sig, 0, 'X')
        await log1.join(log2)
      } catch (e) {
        err = e.toString()
      }
      assert.equal(err, `Error: Invalid signature in entry '${log2.values[0].hash}'`)
      assert.equal(log1.values.length, 1)
      assert.equal(log1.values[0].payload, 'one')
    })
  })
})
