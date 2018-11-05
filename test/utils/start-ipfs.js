'use strict'

const IPFSFactory = require('ipfsd-ctl')
const DatastoreLevel = require('datastore-level')
const IPFSRepo = require('ipfs-repo')
const isNode = require('is-node')
const testAPIs = require('./test-apis')

const repoConf = {
  storageBackends: {
    blocks: DatastoreLevel
  }
}

/**
 * Start an IPFS instance
 * @param  {Object}  config  [IPFS configuration to use]
 * @return {[Promise<IPFS>]} [IPFS instance]
 */
const startIpfs = (type, config = {}) => {
  return new Promise((resolve, reject) => {
    if (!testAPIs[type]) {
      reject(new Error(`Wanted API type ${JSON.stringify(type)} is unknown. Available types: ${Object.keys(testAPIs).join(', ')}`))
    }

    // Use custom storage backend for IPFS block store
    // NOTE: need to duck-type 'repoPath' instead of 'repo' as ipfsd-ctl
    // flips the two, so passing 'repo' doesn't work as it does with js-ipfs
    if (isNode) {
      // Use DatastoreLevel only in Nodejs environment
      config = Object.assign({}, config, { repoPath: new IPFSRepo(config.repo, repoConf) })
    }

    // If we're starting a process, pass command line arguments to it
    if (!config.args) {
      config.args = ['--enable-pubsub-experiment']
    }

    // Spawn an IPFS daemon (type defined in)
    IPFSFactory
      .create(testAPIs[type])
      .spawn(config, async (err, ipfsd) => {
        if (err) {
          return reject(err)
        }
        resolve(ipfsd.api)
      })
  })
}

module.exports = startIpfs
