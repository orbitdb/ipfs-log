'use strict'

const pWhilst = require('p-whilst')
const pMap = require('p-map')
const Entry = require('./entry')

class LogLoader {
  // Fetch log graphs in parallel
  static fetchParallel (ipfs, hashes, length, exclude = [], concurrency, onProgressCallback) {
    const fetchOne = (hash) => LogLoader.fetchAll(ipfs, hash, length, exclude, 2000, onProgressCallback)
    const concatArrays = (arr1, arr2) => arr1.concat(arr2)
    const flatten = (arr) => arr.reduce(concatArrays, [])
    return pMap(hashes, fetchOne, { concurrency: Math.max(concurrency || hashes.length, 1) })
      .then(flatten) // Flatten the results
  }

  /**
   * Fetch log entries sequentially
   *
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {string} [hash] Multihash of the entry to fetch
   * @param {string} [parent] Parent of the node to be fetched
   * @param {Object} [all] Entries to skip
   * @param {Number} [amount=-1] How many entries to fetch
   * @param {Number} [depth=0] Current depth of the recursion
   * @param {function(hash, entry, parent, depth)} onProgressCallback
   * @returns {Promise<Array<Entry>>}
   */
  static fetchAll (ipfs, hashes, amount, exclude = [], timeout = 2000, onProgressCallback) {
    let result = []
    let cache = {}
    let loadingQueue = Array.isArray(hashes)
      ? hashes.slice()
      : [hashes]

    // Add a multihash to the loading queue
    const addToLoadingQueue = e => loadingQueue.push(e)

    // Add entries that we don't need to fetch to the "cache"
    var addToExcludeCache = e => cache[e.hash] = e
    exclude.forEach(addToExcludeCache)

    const shouldFetchMore = () => {
      return loadingQueue.length > 0 &&
        (result.length < amount || amount < 0)
    }

    const fetchEntry = () => {
      const hash = loadingQueue.shift()

      if (cache[hash]) {
        const entry = cache[hash]
        entry.next.forEach(addToLoadingQueue)
        if (onProgressCallback) 
          onProgressCallback(hash, entry, result.length)
        return Promise.resolve()
      }

      return new Promise((resolve, reject) => {
        // Resolve the promise after a timeout in order to
        // not get stuck loading a block that is unreachable
        const timer = setTimeout(resolve, timeout)

        const addToResults = (entry) => {
          clearTimeout(timer)
          if (Entry.isEntry(entry)) {
            entry.next.forEach(addToLoadingQueue)
            result.push(entry)
            cache[hash] = entry
            if (onProgressCallback) 
              onProgressCallback(hash, entry, result.length)
          }
        }

        // Load the entry
        Entry.fromMultihash(ipfs, hash)
          .then(addToResults)
          .then(resolve)
      })
    }

    return pWhilst(shouldFetchMore, fetchEntry)
      .then(() => result)
  }
}

module.exports = LogLoader
