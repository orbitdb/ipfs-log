'use strict'

const IPFS = require('ipfs')
const IdentityProvider = require('orbit-db-identity-provider')
const Log = require('../../src/log')

const dataPath = './ipfs-log/examples/browser/ipfs-0.34.4'
const ipfs = new IPFS({
  repo: dataPath + '/index.js',
  start: false,
  EXPERIMENTAL: {
    pubsub: true
  }
})

ipfs.on('error', (e) => console.error(e))

ipfs.on('ready', async () => {
  const identity = await IdentityProvider.createIdentity({ id: 'exampleUser' })
  const outputElm = document.getElementById('output')

  // When IPFS is ready, add some log entries
  let log = new Log(ipfs, identity, { logId: 'example-log' })

  await log.append('one')
  const values = JSON.stringify(log.values, null, 2)
  console.log('\n', values)
  outputElm.innerHTML += values + '<br><br><hr>'

  await log.append({ two: 'hello' })
  const values2 = JSON.stringify(log.values, null, 2)
  console.log('\n', values2)
  outputElm.innerHTML += values2 + '<br><br>'
})
