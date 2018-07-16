'use strict'

const pWhilst = require('p-whilst')
const pMap = require('p-map')
const Entry = require('./entry')

class EntryIO {
  // Fetch log graphs in parallel
  static fetchParallel (ipfs, hashes, length, exclude = [], concurrency, timeout, onProgressCallback) {
    const fetchOne = (hash) => EntryIO.fetchAll(ipfs, hash, length, exclude, timeout, onProgressCallback)
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
  static fetchAll (ipfs, hashes, amount, exclude = [], timeout = null, onProgressCallback) {
    let result = []
    let cache = {}
    let loadingQueue = Array.isArray(hashes)
      ? hashes.slice()
      : [hashes]

    // Add a multihash to the loading queue
    const addToLoadingQueue = e => loadingQueue.push(e)

    // Add entries that we don't need to fetch to the "cache"
    var addToExcludeCache = e => cache[e.hash] = e
    exclude && exclude.length && exclude.forEach(addToExcludeCache)

    const shouldFetchMore = () => {
      return loadingQueue.length > 0
          && (result.length < amount || amount < 0)
    }

    const fetchEntry = () => {
      const hash = loadingQueue.shift()

      if (cache[hash]) {
        return Promise.resolve()
      }

      return new Promise((resolve, reject) => {
        // Resolve the promise after a timeout (if given) in order to
        // not get stuck loading a block that is unreachable
        const timer = timeout 
        ? setTimeout(() => {
            console.warn(`Warning: Couldn't fetch entry '${hash}', request timed out (${timeout}ms)`)
            resolve()
          } , timeout) 
        : null

        const addToResults = (entry) => {
          clearTimeout(timer)
          if (Entry.isEntry(entry)) {
            entry.next.forEach(addToLoadingQueue)
            result.push(entry)
            cache[hash] = entry
            if (onProgressCallback) {
              onProgressCallback(hash, entry, result.length)
            }
          }
        }

        // Load the entry
        Entry.fromMultihash(ipfs, hash)
          .then(addToResults)
          .then(resolve)
          .catch(err => {
            resolve()
          })
      })
    }

    return pWhilst(shouldFetchMore, fetchEntry)
      .then(() => result)
  }
}

module.exports = EntryIO
