'use strict'

const pMap = require('p-map')
const Entry = require('./entry')
const EntryIO = require('./entry-io')
const Clock = require('./lamport-clock')
const LogError = require('./log-errors')
const isDefined = require('./utils/is-defined')
const _uniques = require('./utils/uniques')
const intersection = require('./utils/intersection')
const difference = require('./utils/difference')

const last = (arr, n) => arr.slice(arr.length - n, arr.length)

class LogIO {
  static async toMultihash (immutabledb, log) {
    if (!isDefined(immutabledb)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(log)) throw LogError.LogNotDefinedError()
    if (log.values.length < 1) throw new Error(`Can't serialize an empty log`)
    const dagNode = await immutabledb.object.put(log.toBuffer())
    return dagNode.toJSON().multihash
  }

  /**
   * Create a log from multihash
   * @param {IPFS} ipfs - An IPFS instance
   * @param {string} hash - Multihash (as a Base58 encoded string) to create the log from
   * @param {Number} [length=-1] - How many items to include in the log
   * @param {function(hash, entry, parent, depth)} onProgressCallback
   * @returns {Promise<Log>}
   */
  static async fromMultihash (immutabledb, hash, length = -1, exclude, onProgressCallback) {
    if (!isDefined(immutabledb)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(hash)) throw new Error(`Invalid hash: ${hash}`)

    const dagNode = await immutabledb.object.get(hash, { enc: 'base58' })
    const logData = JSON.parse(dagNode.toJSON().data)
    if (!logData.heads || !logData.id) throw LogError.NotALogError()

    const entries = await EntryIO.fetchAll(immutabledb, logData.heads, length, exclude, null, onProgressCallback)

    // Find latest clock
    const clock = entries.reduce((clock, entry) => {
      if (entry.clock.time > clock.time) {
        return new Clock(entry.clock.id, entry.clock.time)
      }
      return clock
    }, new Clock(logData.id))

    const finalEntries = entries.slice().sort(Entry.compare)
    const heads = finalEntries.filter(e => logData.heads.includes(e.hash))
    return {
      id: logData.id,
      values: finalEntries,
      heads: heads,
      clock: clock,
    }
  }

  static async fromEntryHash (ipfs, entryHash, id, length = -1, exclude, onProgressCallback) {
    if (!isDefined(ipfs)) throw LogError.IpfsNotDefinedError()
    if (!isDefined(entryHash)) throw new Error("'entryHash' must be defined")

    // Fetch given length, return size at least the given input entries
    length = length > -1 ? Math.max(length, 1) : length

    // Make sure we pass hashes instead of objects to the fetcher function
    const excludeHashes = exclude// ? exclude.map(e => e.hash ? e.hash : e) : exclude
    const entries = await EntryIO.fetchParallel(ipfs, [entryHash], length, excludeHashes, null, null, onProgressCallback)
    // Cap the result at the right size by taking the last n entries,
    // or if given length is -1, then take all
    const sliced = length > -1 ? last(entries, length) : entries
    return {
      values: sliced,
    }
  }

  static async fromJSON (ipfs, json, length = -1, key, timeout, onProgressCallback) {
    if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError()
    const entries = await EntryIO.fetchParallel(ipfs, json.heads.map(e => e.hash), length, [], 16, timeout, onProgressCallback)

    const finalEntries = entries.slice().sort(Entry.compare)
    const heads = entries.filter(e => json.heads.includes(e.hash))
    return {
      id: json.id,
      values: finalEntries,
      heads: json.heads,
    }
  }

  /**
   * Create a new log starting from an entry
   * @param {IPFS} ipfs An IPFS instance
   * @param {Array<Entry>} entries An entry or an array of entries to fetch a log from
   * @param {Number} [length=-1] How many entries to include. Default: infinite.
   * @param {Array<Entry|string>} [exclude] Entries to not fetch (cached)
   * @param {function(hash, entry, parent, depth)} [onProgressCallback]
   * @returns {Promise<Log>}
   */
  static async fromEntry (immutabledb, sourceEntries, length = -1, exclude, key, keys, onProgressCallback) {
    if (!isDefined(immutabledb)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(sourceEntries)) throw new Error("'sourceEntries' must be defined")

    // Make sure we only have Entry objects as input
    if (!Array.isArray(sourceEntries) && !Entry.isEntry(sourceEntries)) {
      throw new Error(`'sourceEntries' argument must be an array of Entry instances or a single Entry`)
    }

    if (!Array.isArray(sourceEntries)) {
      sourceEntries = [sourceEntries]
    }

    // Fetch given length, return size at least the given input entries
    length = length > -1 ? Math.max(length, sourceEntries.length) : length

    // Make sure we pass hashes instead of objects to the fetcher function
    const excludeHashes = exclude ? exclude.map(e => e.hash ? e.hash : e) : exclude
    const hashes = sourceEntries.map(e => e.hash)

    // Fetch the entries
    const entries = await EntryIO.fetchParallel(immutabledb, hashes, length, excludeHashes, null, null, onProgressCallback)

    // Combine the fetches with the source entries and take only uniques
    const combined = sourceEntries.concat(entries)
    const uniques = _uniques(combined, 'hash').sort(Entry.compare)

    // Cap the result at the right size by taking the last n entries
    const sliced = uniques.slice(length > -1 ? -length : -uniques.length)

    // Make sure that the given input entries are present in the result
    // in order to not lose references
    const missingSourceEntries = difference(sliced, sourceEntries, 'hash')

    const replaceInFront = (a, withEntries) => {
      var sliced = a.slice(withEntries.length, a.length)
      return withEntries.concat(sliced)
    }

    // Add the input entries at the beginning of the array and remove
    // as many elements from the array before inserting the original entries
    const result = replaceInFront(sliced, missingSourceEntries)
    return {
      id: result[result.length - 1].id,
      values: result,
    }
  }
}

module.exports = LogIO
