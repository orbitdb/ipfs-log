'use strict'

const Entry = require('./entry')
const EntryIO = require('./entry-io')
const Clock = require('./lamport-clock')
const LogError = require('./log-errors')
const { isDefined, findUniques, difference, io } = require('./utils')

const IPLD_LINKS = ['heads']
const last = (arr, n) => arr.slice(arr.length - n, arr.length)

class LogIO {
  /**
   * Get the CID of a Log.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Log} log Log to get a CID for
   * @returns {Promise<string>}
   */
  static async toCID (ipfs, log) {
    if (!isDefined(ipfs)) throw LogError.IPFSNotDefinedError()
    if (!isDefined(log)) throw LogError.LogNotDefinedError()
    if (log.values.length < 1) throw new Error(`Can't serialize an empty log`)

    return io.write(ipfs, 'dag-cbor', log.toJSON(), { links: IPLD_LINKS })
  }

  /**
   * Get the multihash of a Log.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Log} log Log to get a multihash for
   * @returns {Promise<string>}
   * @deprecated
   */
  static async toMultihash (ipfs, log) {
    if (!isDefined(ipfs)) throw LogError.IPFSNotDefinedError()
    if (!isDefined(log)) throw LogError.LogNotDefinedError()
    if (log.values.length < 1) throw new Error(`Can't serialize an empty log`)

    return io.write(ipfs, 'dag-pb', log.toJSON(), { links: IPLD_LINKS })
  }

  /**
   * Create a log from a CID.
   * @param {IPFS} ipfs An IPFS instance
   * @param {string} cid The CID of the log
   * @param {Object} options
   * @param {number} options.length How many items to include in the log
   * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
   * @param {function(cid, entry, parent, depth)} options.onProgressCallback
   */
  static async fromCID (ipfs, cid, { length = -1, exclude, onProgressCallback } = {}) {
    if (!isDefined(ipfs)) throw LogError.IPFSNotDefinedError()
    if (!isDefined(cid)) throw new Error(`Invalid CID: ${cid}`)

    const logData = await io.read(ipfs, cid, { links: IPLD_LINKS })
    if (!logData.heads || !logData.id) throw LogError.NotALogError()

    const entries = await EntryIO.fetchAll(ipfs, logData.heads,
      { length, exclude, onProgressCallback })

    // Find latest clock
    const clock = entries.reduce((clock, entry) => {
      if (entry.clock.time > clock.time) {
        return new Clock(entry.clock.id, entry.clock.time)
      }
      return clock
    }, new Clock(logData.id))

    const finalEntries = entries.slice().sort(Entry.compare)
    const heads = finalEntries.filter(e => logData.heads.includes(e.cid))
    return {
      id: logData.id,
      values: finalEntries,
      heads: heads,
      clock: clock
    }
  }

  /**
   * Create a log from an entry CID.
   * @param {IPFS} ipfs An IPFS instance
   * @param {string} entryCid The CID of the entry
   * @param {Object} options
   * @param {number} options.length How many items to include in the log
   * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
   * @param {function(cid, entry, parent, depth)} options.onProgressCallback
   */
  static async fromEntryCid (ipfs, entryCid, { length = -1, exclude, onProgressCallback }) {
    if (!isDefined(ipfs)) throw LogError.IpfsNotDefinedError()
    if (!isDefined(entryCid)) throw new Error("'entryCid' must be defined")

    // Convert input cid(s) to an array
    const entryCids = Array.isArray(entryCid) ? entryCid : [entryCid]

    // Fetch given length, return size at least the given input entries
    length = length > -1 ? Math.max(length, 1) : length

    const entries = await EntryIO.fetchParallel(ipfs, entryCids,
      { length, exclude, onProgressCallback })
    // Cap the result at the right size by taking the last n entries,
    // or if given length is -1, then take all
    const sliced = length > -1 ? last(entries, length) : entries
    return {
      values: sliced
    }
  }

  /**
   * Creates a log data from a JSON object, to be passed to a Log constructor
   *
   * @param {IPFS} ipfs An IPFS instance
   * @param {json} json A json object containing valid log data
   * @param {Object} options
   * @param {number} options.length How many entries to include
   * @param {number} options.timeout Maximum time to wait for each fetch operation, in ms
   * @param {function(cid, entry, parent, depth)} options.onProgressCallback
   **/
  static async fromJSON (ipfs, json, { length = -1, timeout, onProgressCallback }) {
    if (!isDefined(ipfs)) throw LogError.IPFSNotDefinedError()
    json.heads.forEach(Entry.ensureInterop)
    const headCids = json.heads.map(e => e.cid)
    const entries = await EntryIO.fetchParallel(ipfs, headCids,
      { length, exclude: [], concurrency: 16, timeout, onProgressCallback })
    const finalEntries = entries.slice().sort(Entry.compare)
    return {
      id: json.id,
      values: finalEntries,
      heads: json.heads
    }
  }

  /**
   * Create a new log starting from an entry.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Entry|Array<Entry>} sourceEntries An entry or an array of entries to fetch a log from
   * @param {Object} options
   * @param {number} options.length How many entries to include
   * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
   * @param {function(cid, entry, parent, depth)} options.onProgressCallback
   */
  static async fromEntry (ipfs, sourceEntries, { length = -1, exclude, onProgressCallback }) {
    if (!isDefined(ipfs)) throw LogError.IPFSNotDefinedError()
    if (!isDefined(sourceEntries)) throw new Error("'sourceEntries' must be defined")

    // Make sure we only have Entry objects as input
    if (!Array.isArray(sourceEntries) && !Entry.isEntry(sourceEntries)) {
      throw new Error(`'sourceEntries' argument must be an array of Entry instances or a single Entry`)
    }

    if (!Array.isArray(sourceEntries)) {
      sourceEntries = [sourceEntries]
    }
    sourceEntries.forEach(Entry.ensureInterop)

    // Fetch given length, return size at least the given input entries
    length = length > -1 ? Math.max(length, sourceEntries.length) : length

    // Make sure we pass cids instead of objects to the fetcher function
    const hashes = sourceEntries.map(e => e.cid)

    // Fetch the entries
    const entries = await EntryIO.fetchParallel(ipfs, hashes,
      { length, exclude, onProgressCallback })

    // Combine the fetches with the source entries and take only uniques
    const combined = sourceEntries.concat(entries)
    const uniques = findUniques(combined, 'cid').sort(Entry.compare)

    // Cap the result at the right size by taking the last n entries
    const sliced = uniques.slice(length > -1 ? -length : -uniques.length)

    // Make sure that the given input entries are present in the result
    // in order to not lose references
    const missingSourceEntries = difference(sliced, sourceEntries, 'cid')

    const replaceInFront = (a, withEntries) => {
      var sliced = a.slice(withEntries.length, a.length)
      return withEntries.concat(sliced)
    }

    // Add the input entries at the beginning of the array and remove
    // as many elements from the array before inserting the original entries
    const result = replaceInFront(sliced, missingSourceEntries)
    return {
      id: result[result.length - 1].id,
      values: result
    }
  }
}

module.exports = LogIO
