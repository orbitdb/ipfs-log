'use strict'

const startIpfs = (IPFS, ipfsConfig) => {
  return new Promise((resolve, reject) => {
    const ipfs = new IPFS(ipfsConfig)
    ipfs.on('error', reject)
    ipfs.on('ready', () => resolve(ipfs))
  })
}

module.exports = startIpfs
