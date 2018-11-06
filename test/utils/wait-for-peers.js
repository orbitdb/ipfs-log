'use strict'

const waitForPeers = (ipfs, peersToWait, topic) => {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const peers = await ipfs.pubsub.peers(topic)
        // peers are not connecting, dunno why
        console.log(peers)
        const hasAllPeers = peersToWait.map((e) => peers.includes(e)).filter((e) => e === false).length === 0
        if (hasAllPeers) {
          console.log('Found peers!')
          clearInterval(interval)
          resolve()
        }
      } catch (e) {
        clearInterval(interval)
        reject(e)
      }
    }, 200)
  })
}

module.exports = waitForPeers
