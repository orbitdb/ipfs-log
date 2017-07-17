'use strict'

const isDefined = require('./is-defined')
const Log = require('./log')
const LogLoader = require('./log-loader')
const Entry = require('./entry')
const EntrySet = require('./entry-set')
const Clock = require('./lamport-clock')

// Error messages
const IpfsNotDefinedError = () => new Error('Ipfs instance not defined')
const LogNotDefinedError = () => new Error('Log instance not defined')
const NotALogError = () => new Error('Given argument is not an instance of Log')

/**
 * ipfs-log
 *
 * @example
 * // https://github.com/haadcode/ipfs-log/blob/master/examples/log.js
 * const IPFS = require('ipfs-daemon')
 * const Log  = require('ipfs-log')
 * const ipfs = new IPFS()
 *
 * ipfs.on('ready', () => {
 *   const log1 = Log.create('A')
 *   const log2 = Log.create('B')
 *   const log3 = await Log.append(ipfs, log1, 'hello')
 *   const log4 = await Log.append(ipfs, log2, { two: 'hi' })
 *   const out = Log.join(log3, log4).values.map((e) => e.payload)
 *   console.log(out)
 *   // ['hello', '{ two: 'hi' }']
 * })
 */
class LogUtils {
  /**
   * Create a new log
   * @param {string} [id] Unique ID for the log
   * @param {Array} [entries] - Entries for this log
   * @param {Array} [heads] - Heads for this log
   * @returns {Log}
   */
  static create (id, entries, heads, clock, size = -1, sortedInput = false) {
    // if (isDefined(entries) && !Array.isArray(entries)) throw new Error(`'entries' argument must be an array`)
    if (isDefined(entries) && !EntrySet.isSet(entries) && !Array.isArray(entries)) {
      throw new Error(`'entries' argument must be an EntrySet or an array of Entry instances`)
    }

    if (isDefined(heads) && !Array.isArray(heads)) {
      throw new Error(`'heads' argument must be an array`)
    }

    if (!EntrySet.isSet(entries)) {
      entries = new EntrySet(entries)
    }

    if (!sortedInput) {
      // Sort the entries
      entries = entries.sort()
    }

    // If size was provided, cap the lenght of the log
    if (size > -1) {
      entries = entries.slice(-size)
    }

    // If entries were given but not the heads, find them
    if (!isDefined(heads)) {
      heads = entries.heads
    } else {
      // If heads were passed as an array of multihashes,
      // convert them to Entry objects (they're in the entry set)
      heads = heads.map(e => Entry.isEntry(e) ? e : entries.get(e))
    }

    // If ID wasn't provided, use the first head's ID
    if (!isDefined(id)) {
      if (!isDefined(entries) || entries.length === 0) throw new Error('Log requires an id')
      id = clock ? clock.id : entries.get(heads[0].hash).clock.id
    }

    if (!isDefined(clock) && isDefined(entries)) {
      const last = entries.values.slice(-1)[0]
      clock = new Clock(id, last ? last.clock.time : null)
    }

    return new Log(id, entries, heads, clock)
  }

  /**
   * Add an entry to a log
   * @description Adds an entry to the Log and returns a new Log. Doesn't modify the original Log.
   * @memberof Log
   * @static
   * @param {IPFS} ipfs An IPFS instance
   * @param {Log} log - The Log to add the entry to
   * @param {string|Buffer|Object|Array} data - Data of the entry to be added
   *
   * @example
   * const log2 = Log.append(ipfs, log1, 'hello again')
   *
   * @returns {Promise<Log>}
   */
  static append (ipfs, log, data) {
    if (!isDefined(ipfs)) throw IpfsNotDefinedError()
    if (!isDefined(log)) throw LogNotDefinedError()
    if (!LogUtils.isLog(log)) throw NotALogError()

    // Update the clock
    const clock = log.clock.tick()

    // Add the entry to the log,
    // as a named function to make it optimizable for VMs
    const appendToLog = (entry) => log.append(entry)

    // Create the entry and add it to the log
    return Entry.create(ipfs, log.id, null, data, log.heads, clock)
      .then(appendToLog)
  }

  /**
   * Join two logs
   *
   * @description Joins two logs returning a new log. Doesn't mutate the original logs.
   *
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Log} a First log to join
   * @param {Log} b Second log to join
   * @param {Number} [size] Max size of the joined log
   * @param {string} [id] ID to use for the new log
   *
   * @example
   * const log = Log.join(log1, log2)
   *
   * @returns {Log}
   */
  static join (a, b, size = -1, id) {
    if (!isDefined(a) || !isDefined(b)) throw LogNotDefinedError()
    if (!LogUtils.isLog(a)) throw NotALogError()
    if (!LogUtils.isLog(b)) throw NotALogError()

    // If id is not specified, use greater id of the two logs
    id = id ? id : [a, b].sort((a, b) => a.id > b.id)[0].id

    // Combine the first log entries with the second log entries,
    const merged = a.entries.merge(b.entries)

    // Order the clocks by 1) same id as given input id or 2) greater than id
    const clocksSortedById = [a.clock, b.clock].sort((a, b) => a.id === id ? -1 : a.id > b.id)

    // Update the values of the first clock with the values from the second clock
    let clock = new Clock(id, clocksSortedById[0].time)
    clock.merge(clocksSortedById[1])

    // Create a log from the entries using the
    return LogUtils.create(id, merged, null, clock, size)
  }

  /**
   * Join multiple logs
   * @param {Array<Log>} logs Logs to join together
   * @param {Number} length Maximum lenght of the log after join
   * @returns {Log}
   */
  static joinAll (logs, length) {
    return logs.reduce((log, val, i) => {
      if (!log) return val
      return LogUtils.join(log, val, length)
    }, null)
  }

  /**
   * Check if an object is an instance of Log
   * @param  {Log} log Object to check
   * @return {Boolean} True if the given object is a Log instance
   */
  static isLog (log) {
    return log.id !== undefined
      && log.heads !== undefined
      && log.values !== undefined
  }

  /**
   * Expand the size of the log
   * @param {IPFS} [ipfs] An IPFS instance
   * @param {Log} log
   * @param {Number} length
   * @param {function(hash, entry, parent, depth)} onProgressCallback
   * @returns {Promise<Log>}
   */
  static expand (ipfs, log, amount = -1) {
    if (!isDefined(ipfs)) throw IpfsNotDefinedError()
    if (!isDefined(log)) throw LogNotDefinedError()
    if (!LogUtils.isLog(log)) throw NotALogError()

    // If we don't have any tails, we can't expand anymore
    if (log.tailHashes.length === 0) {
      return Promise.resolve(LogUtils.create(log.id, log.entries, log.heads, log.clock, -1, true))
    }

    // Fetch all chains from tails, put them together and cap the size
    return LogLoader.fetchParallel(ipfs, log.tailHashes, amount, log.values)
      .then((entries) => new EntrySet(entries))
      .then((entrySet) => {
        // Cap the length of the new collection (current length + wanted size)
        const size = amount > -1 ? (log.entries.length + amount) : -1

        // Join the fetched entries with the log to order them first
        const sliced = log.entries.merge(entrySet).last(size)

        // Because the clocks can vary drastically, we need to make sure that
        // we keep all the original entries in order to not lose references.
        // So we do the following:
        // 1) the old entries that are not in the sliced entries
        // 2) New entries without the old entries
        // 3) Entries that are in both

        // These together are the entries we need to put back in
        const missingOldEntries = sliced.difference(log.entries)
        const withoutOldEntries = log.entries.difference(sliced)
        const entryIntersection = log.entries.intersection(sliced)

        // Calculate how many entries we keep from the remaining new entries
        const length = size - (entryIntersection.length + missingOldEntries.length)
        const remainingNewEntries = withoutOldEntries.last(length)

        // Merge all the entries we want to keep
        const merged = entryIntersection.merge(remainingNewEntries).merge(missingOldEntries)

        return LogUtils.create(log.id, merged, null, log.clock, size)
      })
  }

  static expandFrom (ipfs, log, entries, amount = -1) {
    if (!isDefined(ipfs)) throw IpfsNotDefinedError()
    if (!isDefined(log)) throw LogNotDefinedError()
    if (!isDefined(entries)) throw new Error(`'entries' must be given as argument`)
    if (!LogUtils.isLog(log)) throw NotALogError()

    if (!Array.isArray(entries) && !EntrySet.isSet(entries)) {
      entries = [entries]
    }

    if (!EntrySet.isSet(entries)) {
      entries = new EntrySet(entries)
    }

    // Hashes of the next references, array per entry,
    // resulting an an array of arrays
    const hashes = entries.values.map(e => e.next).filter(e => e.length > 0)

    // If we don't have tails, we can't expand anymore, return
    if (hashes.length === 0) {
      return Promise.resolve(LogUtils.create(log.id, log.entries, log.heads, log.clock, -1, true))
    }

    return LogLoader.fetchParallel(ipfs, hashes, amount, log.values, hashes.length)
      .then((entries) => new EntrySet(entries))
      .then((entrySet) => {
        // TODO: speed this up by fetching one tail set, merge, check, repeat if needed

        // Cap the length of the new collection (current length + wanted size)
        const size = amount > -1 ? (log.entries.length + amount) : -1
        const newEntries = log.entries.merge(entrySet.slice(0, amount))

        return LogUtils.create(log.id, newEntries, null, log.clock, size)
      })
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
  static fromEntry (ipfs, sourceEntries, length = -1, exclude, onProgressCallback) {
    if (!isDefined(ipfs)) throw IpfsNotDefinedError()
    if (!isDefined(sourceEntries)) throw new Error("'sourceEntries' must be defined")

    // Make sure we only have Entry objects as input
    if (!EntrySet.isSet(sourceEntries) && !Array.isArray(sourceEntries) && !Entry.isEntry(sourceEntries)) {
      throw new Error(`'sourceEntries' argument must be an EntrySet, an array of Entry instances or a single Entry`)
    }

    // Convert the input to an EntrySet
    if (sourceEntries && !EntrySet.isSet(sourceEntries)) {
      if (!Array.isArray(sourceEntries)) sourceEntries = [sourceEntries]
      sourceEntries = new EntrySet(sourceEntries)
    }

    // Fetch given length, return size at least the given input entries
    length = length > -1 ? Math.max(length, sourceEntries.length) : length

    // Make sure we pass hashes instead of objects to the fetcher function
    const excludeHashes = exclude ? exclude.map(e => e.hash ? e.hash : e) : exclude

    return LogLoader.fetchParallel(ipfs, sourceEntries.keys, length, excludeHashes, null, onProgressCallback)
      .then((entries) => new EntrySet(entries))
      .then((entrySet) => {
        // Cap the result at the right size by taking the last n entries
        const sliced = sourceEntries.merge(entrySet).last(length)

        // Make sure that the given input entries are present in the result
        // in order to not lose references
        const missingSourceEntries = sliced.difference(sourceEntries)

        // Add the input entries at the beginning of the array and remove
        // as many elements from the array before inserting the original entries
        const result = sliced.replaceInFront(missingSourceEntries)

        return LogUtils.create(null, result)
      })
  }

  /**
   * Create a log from multihash
   * @param {IPFS} ipfs - An IPFS instance
   * @param {string} hash - Multihash (as a Base58 encoded string) to create the log from
   * @param {Number} [length=-1] - How many items to include in the log
   * @param {function(hash, entry, parent, depth)} onProgressCallback
   * @returns {Promise<Log>}
   */
  static fromMultihash (ipfs, hash, length = -1, exclude, onProgressCallback) {
    if (!isDefined(ipfs)) throw IpfsNotDefinedError()
    if (!isDefined(hash)) throw new Error(`Invalid hash: ${hash}`)

    return ipfs.object.get(hash, { enc: 'base58' })
      .then((dagNode) => JSON.parse(dagNode.toJSON().data))
      .then((logData) => {
        if (!logData.heads || !logData.id) throw NotALogError()
        return LogLoader.fetchAll(ipfs, logData.heads, length, exclude, 2000, onProgressCallback)
          .then((entries) => LogUtils.create(logData.id, entries, logData.heads))
      })
  }

  static fromJSON (ipfs, json, length = -1, onProgressCallback) {
    if (!isDefined(ipfs)) throw IpfsNotDefinedError()
    const pMap = require('p-map')
    const mapper = (e, idx) => {
      return Entry.create(ipfs, e.id, e.seq, e.payload, e.next, e.clock, e.hash)
        .then((entry) => {
          onProgressCallback(entry.hash, entry, idx + 1, json.entries.length)
          return entry
        })
    }
    return pMap(length && length > -1 ? json.entries.slice(0, length) : json.entries, mapper, { concurrency: 4 })
      .then((entries) => {
        const heads = entries.filter(e => json.heads.map(a => a.hash).includes(e.hash))
        return LogUtils.create(json.id, entries, heads)
      })
  }

  /**
   * Get the log's multihash
   * @param {IPFS} ipfs An IPFS instance
   * @param {Log} log Log to persist
   * @returns {Promise<string>}
   */
  static toMultihash (ipfs, log) {
    if (!isDefined(ipfs)) throw IpfsNotDefinedError()
    if (!isDefined(log)) throw LogNotDefinedError()
    if (!LogUtils.isLog(log)) throw NotALogError()
    if (log.values.length < 1) throw new Error(`Can't serialize an empty log`)
    if (log.heads.length < 1) throw new Error(`Can't serialize a log without heads`)

    return ipfs.object.put(log.toBuffer())
      .then((dagNode) => dagNode.toJSON().multihash)
  }
}

module.exports = LogUtils
