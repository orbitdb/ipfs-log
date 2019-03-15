'use strict'

const pMap = require('p-map')
const GSet = require('./g-set')
const Entry = require('./entry')
const LogIO = require('./log-io')
const LogError = require('./log-errors')
const Clock = require('./lamport-clock')
const { LastWriteWins, NoZeroes } = require('./log-sorting')
const AccessController = require('./default-access-controller')
const { isDefined, findUniques } = require('./utils')

const randomId = () => new Date().getTime().toString()
const getCid = e => e.cid
const flatMap = (res, acc) => res.concat(acc)
const getNextPointers = entry => entry.next
const maxClockTimeReducer = (res, acc) => Math.max(res, acc.clock.time)
const uniqueEntriesReducer = (res, acc) => {
  res[acc.cid] = acc
  return res
}

/**
 * Log.
 *
 * @description
 * Log implements a G-Set CRDT and adds ordering.
 *
 * From:
 * "A comprehensive study of Convergent and Commutative Replicated Data Types"
 * https://hal.inria.fr/inria-00555588
 */
class Log extends GSet {
  /**
   * Create a new Log instance
   * @param {IPFS} ipfs An IPFS instance
   * @param {Object} identity Identity (https://github.com/orbitdb/orbit-db-identity-provider/blob/master/src/identity.js)
   * @param {Object} options
   * @param {string} options.logId ID of the log
   * @param {Object} options.access AccessController (./default-access-controller)
   * @param {Array<Entry>} options.entries An Array of Entries from which to create the log
   * @param {Array<Entry>} options.heads Set the heads of the log
   * @param {Clock} options.clock Set the clock of the log
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @return {Log} The log instance
   */
  constructor (ipfs, identity, { logId, access, entries, heads, clock, sortFn } = {}) {
    if (!isDefined(ipfs)) {
      throw LogError.IPFSNotDefinedError()
    }

    if (!isDefined(identity)) {
      throw new Error('Identity is required')
    }

    if (!isDefined(access)) {
      access = new AccessController()
    }

    if (isDefined(entries) && !Array.isArray(entries)) {
      throw new Error(`'entries' argument must be an array of Entry instances`)
    }

    if (isDefined(heads) && !Array.isArray(heads)) {
      throw new Error(`'heads' argument must be an array`)
    }

    if (!isDefined(sortFn)) {
      sortFn = LastWriteWins
    }

    super()

    this._sortFn = NoZeroes(sortFn)

    this._storage = ipfs
    this._id = logId || randomId()

    // Access Controller
    this._access = access
    // Identity
    this._identity = identity

    // Add entries to the internal cache
    entries = entries || []
    this._entryIndex = entries.reduce(uniqueEntriesReducer, {})

    // Set heads if not passed as an argument
    heads = heads || Log.findHeads(entries)
    this._headsIndex = heads.reduce(uniqueEntriesReducer, {})

    // Index of all next pointers in this log
    this._nextsIndex = {}
    const addToNextsIndex = e => e.next.forEach(a => (this._nextsIndex[a] = e.cid))
    entries.forEach(addToNextsIndex)

    // Set the length, we calculate the length manually internally
    this._length = entries.length

    // Set the clock
    const maxTime = Math.max(clock ? clock.time : 0, this.heads.reduce(maxClockTimeReducer, 0))
    // Take the given key as the clock id is it's a Key instance,
    // otherwise if key was given, take whatever it is,
    // and if it was null, take the given id as the clock id
    this._clock = new Clock(this._identity.publicKey, maxTime)
  }

  /**
   * Returns the ID of the log.
   * @returns {string}
   */
  get id () {
    return this._id
  }

  /**
   * Returns the clock of the log.
   * @returns {string}
   */
  get clock () {
    return this._clock
  }

  /**
   * Returns the length of the log.
   * @return {number} Length
   */
  get length () {
    return this._length
  }

  /**
   * Returns the values in the log.
   * @returns {Array<Entry>}
   */
  get values () {
    return Object.values(this.traverse(this.heads)).reverse()
  }

  /**
   * Returns an array of heads as cids.
   * @returns {Array<string>}
   */
  get heads () {
    return Object.values(this._headsIndex).sort(this._sortFn).reverse()
  }

  /**
   * Returns an array of Entry objects that reference entries which
   * are not in the log currently.
   * @returns {Array<Entry>}
   */
  get tails () {
    return Log.findTails(this.values)
  }

  /**
   * Returns an array of cids that are referenced by entries which
   * are not in the log currently.
   * @returns {Array<string>} Array of CIDs
   */
  get tailCids () {
    return Log.findTailCids(this.values)
  }

  /**
   * Find an entry.
   * @param {string} [cid] The CID of the entry
   * @returns {Entry|undefined}
   */
  get (cid) {
    return this._entryIndex[cid]
  }

  /**
   * Checks if a entry is part of the log
   * @param {string} cid The CID of the entry
   * @returns {boolean}
   */
  has (entry) {
    return this._entryIndex[entry.cid || entry] !== undefined
  }

  traverse (rootEntries, amount = -1, endHash) {
    // Sort the given given root entries and use as the starting stack
    var stack = rootEntries.sort(this._sortFn).reverse()
    // Cache for checking if we've processed an entry already
    let traversed = {}
    // End result
    let result = {}
    // We keep a counter to check if we have traversed requested amount of entries
    let count = 0

    // Named function for getting an entry from the log
    const getEntry = e => this.get(e)

    // Add an entry to the stack and traversed nodes index
    const addToStack = entry => {
      // If we've already processed the entry, don't add it to the stack
      if (!entry || traversed[entry.cid]) {
        return
      }

      // Add the entry in front of the stack and sort
      stack = [entry, ...stack]
        .sort(this._sortFn)
        .reverse()

      // Add to the cache of processed entries
      traversed[entry.cid] = true
    }

    // Start traversal
    // Process stack until it's empty (traversed the full log)
    // or when we have the requested amount of entries
    // If requested entry amount is -1, traverse all
    while (stack.length > 0 && (amount === -1 || count < amount)) { // eslint-disable-line no-unmodified-loop-condition
      // Get the next element from the stack
      const entry = stack.shift()

      // Add to the result
      count++
      result[entry.cid] = entry

      // Add entry's next references to the stack
      entry.next.map(getEntry)
        .filter(isDefined)
        .forEach(addToStack)

      // If it is the specified end hash, break out of the while loop
      if (entry.cid === endHash) break
    }

    return result
  }

  /**
   * Append an entry to the log.
   * @param {Entry} entry Entry to add
   * @return {Log} New Log containing the appended value
   */
  async append (data, pointerCount = 1) {
    // Update the clock (find the latest clock)
    const newTime = Math.max(this.clock.time, this.heads.reduce(maxClockTimeReducer, 0)) + 1
    this._clock = new Clock(this.clock.id, newTime)

    // Get the required amount of cids to next entries (as per current state of the log)
    const references = this.traverse(this.heads, Math.max(pointerCount, this.heads.length))
    const nexts = Object.keys(Object.assign({}, this._headsIndex, references))

    // @TODO: Split Entry.create into creating object, checking permission, signing and then posting to IPFS
    // Create the entry and add it to the internal cache
    const entry = await Entry.create(
      this._storage,
      this._identity,
      this.id,
      data,
      nexts,
      this.clock
    )

    const canAppend = await this._access.canAppend(entry, this._identity.provider)
    if (!canAppend) {
      throw new Error(`Could not append entry, key "${this._identity.id}" is not allowed to write to the log`)
    }

    this._entryIndex[entry.cid] = entry
    nexts.forEach(e => (this._nextsIndex[e] = entry.cid))
    this._headsIndex = {}
    this._headsIndex[entry.cid] = entry
    // Update the length
    this._length++
    return entry
  }

  /*
   * Creates a javscript iterator over log entries
   *
   * @param {Object} options
   * @param {string|Array} options.gt Beginning hash of the iterator, non-inclusive
   * @param {string|Array} options.gte Beginning hash of the iterator, inclusive
   * @param {string|Array} options.lt Ending hash of the iterator, non-inclusive
   * @param {string|Array} options.lte Ending hash of the iterator, inclusive
   * @param {amount} options.amount Number of entried to return to / from the gte / lte hash
   * @returns {Symbol.Iterator} Iterator object containing log entries
   *
   * @examples
   *
   * (async () => {
   *   log1 = new Log(ipfs, testIdentity, { logId: 'X' })
   *
   *   for (let i = 0; i <= 100; i++) {
   *     await log1.append('entry' + i)
   *   }
   *
   *   let it = log1.iterator({
   *     lte: 'zdpuApFd5XAPkCTmSx7qWQmQzvtdJPtx2K5p9to6ytCS79bfk',
   *     amount: 10
   *   })
   *
   *   [...it].length // 10
   * })()
   *
   *
   */
  iterator ({ gt = undefined, gte = undefined, lt = undefined, lte = undefined, amount = -1 } =
  {}) {
    if (amount === 0) return (function * () {})()
    if (typeof lte === 'string') lte = [this.get(lte)]
    if (typeof lt === 'string') lt = [this.get(this.get(lt).next)]

    if (lte && !Array.isArray(lte)) throw LogError.LtOrLteMustBeStringOrArray()
    if (lt && !Array.isArray(lt)) throw LogError.LtOrLteMustBeStringOrArray()

    let start = lte || (lt || this.heads)
    let endHash = gte ? this.get(gte).hash : gt ? this.get(gt).hash : null
    let count = endHash ? -1 : amount || -1

    let entries = this.traverse(start, count, endHash)
    let entryValues = Object.values(entries)

    // Strip off last entry if gt is non-inclusive
    if (gt) entryValues.pop()

    // Deal with the amount argument working backwards from gt/gte
    if ((gt || gte) && amount > -1) {
      entryValues = entryValues.slice(entryValues.length - amount, entryValues.length)
    }

    return (function * () {
      for (let i in entryValues) {
        yield entryValues[i]
      }
    })()
  }

  /**
   * Join two logs.
   *
   * Joins another log into this one.
   *
   * @param {Log} log Log to join with this Log
   * @param {number} [size=-1] Max size of the joined log
   * @returns {Promise<Log>} This Log instance
   * @example
   * await log1.join(log2)
   */
  async join (log, size = -1) {
    if (!isDefined(log)) throw LogError.LogNotDefinedError()
    if (!Log.isLog(log)) throw LogError.NotALogError()
    if (this.id !== log.id) return

    // Get the difference of the logs
    const newItems = Log.difference(log, this)

    const identityProvider = this._identity.provider
    // Verify if entries are allowed to be added to the log and throws if
    // there's an invalid entry
    const permitted = async (entry) => {
      const canAppend = await this._access.canAppend(entry, identityProvider)
      if (!canAppend) {
        throw new Error(`Could not append entry, key "${entry.identity.id}" is not allowed to write to the log`)
      }
    }

    // Verify signature for each entry and throws if there's an invalid signature
    const verify = async (entry) => {
      const isValid = await Entry.verify(identityProvider, entry)
      const publicKey = entry.identity ? entry.identity.publicKey : entry.key
      if (!isValid) throw new Error(`Could not validate signature "${entry.sig}" for entry "${entry.cid}" and key "${publicKey}"`)
    }

    const entriesToJoin = Object.values(newItems)
    await pMap(entriesToJoin, permitted, { concurrency: 1 })
    await pMap(entriesToJoin, verify, { concurrency: 1 })

    // Update the internal next pointers index
    const addToNextsIndex = e => {
      const entry = this.get(e.cid)
      if (!entry) this._length++ /* istanbul ignore else */
      e.next.forEach(a => (this._nextsIndex[a] = e.cid))
    }
    Object.values(newItems).forEach(addToNextsIndex)

    // Update the internal entry index
    this._entryIndex = Object.assign(this._entryIndex, newItems)

    // Merge the heads
    const notReferencedByNewItems = e => !nextsFromNewItems.find(a => a === e.cid)
    const notInCurrentNexts = e => !this._nextsIndex[e.cid]
    const nextsFromNewItems = Object.values(newItems).map(getNextPointers).reduce(flatMap, [])
    const mergedHeads = Log.findHeads(Object.values(Object.assign({}, this._headsIndex, log._headsIndex)))
      .filter(notReferencedByNewItems)
      .filter(notInCurrentNexts)
      .reduce(uniqueEntriesReducer, {})

    this._headsIndex = mergedHeads

    // Slice to the requested size
    if (size > -1) {
      let tmp = this.values
      tmp = tmp.slice(-size)
      this._entryIndex = tmp.reduce(uniqueEntriesReducer, {})
      this._headsIndex = Log.findHeads(tmp).reduce(uniqueEntriesReducer, {})
      this._length = Object.values(this._entryIndex).length
    }

    // Find the latest clock from the heads
    const maxClock = Object.values(this._headsIndex).reduce(maxClockTimeReducer, 0)
    this._clock = new Clock(this.clock.id, Math.max(this.clock.time, maxClock))
    return this
  }

  /**
   * Get the log in JSON format.
   * @returns {Object} An object with the id and heads properties
   */
  toJSON () {
    return {
      id: this.id,
      heads: this.heads
        .sort(this._sortFn) // default sorting
        .reverse() // we want the latest as the first element
        .map(getCid) // return only the head cids
    }
  }

  /**
   * Get the log in JSON format as a snapshot.
   * @returns {Object} An object with the id, heads and value properties
   */
  toSnapshot () {
    return {
      id: this.id,
      heads: this.heads,
      values: this.values
    }
  }

  /**
   * Get the log as a Buffer.
   * @returns {Buffer}
   */
  toBuffer () {
    return Buffer.from(JSON.stringify(this.toJSON()))
  }

  /**
   * Returns the log entries as a formatted string.
   * @returns {string}
   * @example
   * two
   * └─one
   *   └─three
   */
  toString (payloadMapper) {
    return this.values
      .slice()
      .reverse()
      .map((e, idx) => {
        const parents = Entry.findChildren(e, this.values)
        const len = parents.length
        let padding = new Array(Math.max(len - 1, 0))
        padding = len > 1 ? padding.fill('  ') : padding
        padding = len > 0 ? padding.concat(['└─']) : padding
        /* istanbul ignore next */
        return padding.join('') + (payloadMapper ? payloadMapper(e.payload) : e.payload)
      })
      .join('\n')
  }

  /**
   * Check whether an object is a Log instance.
   * @param {Object} log An object to check
   * @returns {boolean}
   */
  static isLog (log) {
    return log.id !== undefined &&
      log.heads !== undefined &&
      log._entryIndex !== undefined
  }

  /**
   * Get the log's CID.
   * @returns {Promise<string>} The Log CID
   */
  toCID () {
    return LogIO.toCID(this._storage, this)
  }

  /**
   * Get the log's multihash.
   * @returns {Promise<string>} Multihash of the Log as Base58 encoded string
   * @deprecated
   */
  toMultihash () {
    return LogIO.toMultihash(this._storage, this)
  }

  /**
   * Create a log from a CID.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Identity} identity The identity instance
   * @param {string} cid The log CID
   * @param {Object} options
   * @param {AccessController} options.access The access controller instance
   * @param {number} options.length How many items to include in the log
   * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
   * @param {function(cid, entry, parent, depth)} options.onProgressCallback
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @returns {Promise<Log>}
   * @deprecated
   */
  static async fromCID (ipfs, identity, cid,
    { access, length = -1, exclude, onProgressCallback, sortFn } = {}) {
    // TODO: need to verify the entries with 'key'
    const data = await LogIO.fromCID(ipfs, cid, { length, exclude, onProgressCallback })
    return new Log(ipfs, identity, {
      logId: data.id,
      access: access,
      entries: data.values,
      heads: data.heads,
      clock: data.clock,
      sortFn: sortFn
    })
  }

  /**
    * Create a log from a multihash.
    * @param {IPFS} ipfs An IPFS instance
    * @param {Identity} identity The identity instance
    * @param {string} multihash Multihash (as a Base58 encoded string) to create the Log from
    * @param {Object} options
    * @param {AccessController} options.access The access controller instance
    * @param {number} options.length How many items to include in the log
    * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
    * @param {function(cid, entry, parent, depth)} options.onProgressCallback
    * @param {Function} options.sortFn The sort function - by default LastWriteWins
    * @returns {Promise<Log>}
    * @deprecated
    */
  static async fromMultihash (ipfs, identity, multihash,
    { access, length = -1, exclude, onProgressCallback, sortFn } = {}) {
    return Log.fromCID(ipfs, identity, multihash,
      { access, length, exclude, onProgressCallback, sortFn })
  }

  /**
   * Create a log from a single entry's CID.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Identity} identity The identity instance
   * @param {string} cid The entry's CID
   * @param {Object} options
   * @param {string} options.logId The ID of the log
   * @param {AccessController} options.access The access controller instance
   * @param {number} options.length How many entries to include in the log
   * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
   * @param {function(cid, entry, parent, depth)} options.onProgressCallback
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @return {Promise<Log>} New Log
   */
  static async fromEntryCid (ipfs, identity, cid,
    { logId, access, length = -1, exclude, onProgressCallback, sortFn }) {
    // TODO: need to verify the entries with 'key'
    const data = await LogIO.fromEntryCid(ipfs, cid, { length, exclude, onProgressCallback })
    return new Log(ipfs, identity, { logId, access, entries: data.values, sortFn })
  }

  /**
   * Create a log from a single entry's multihash.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Identity} identity The identity instance
   * @param {string} multihash The entry's multihash
   * @param {Object} options
   * @param {string} options.logId The ID of the log
   * @param {AccessController} options.access The access controller instance
   * @param {number} options.length How many entries to include in the log
   * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
   * @param {function(cid, entry, parent, depth)} options.onProgressCallback
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @return {Promise<Log>} New Log
   * @deprecated
   */
  static async fromEntryHash (ipfs, identity, multihash,
    { logId, access, length = -1, exclude, onProgressCallback, sortFn }) {
    return Log.fromEntryCid(ipfs, identity, multihash,
      { logId, access, length, exclude, onProgressCallback, sortFn })
  }

  /**
   * Create a log from a Log Snapshot JSON.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Identity} identity The identity instance
   * @param {Object} json Log snapshot as JSON object
   * @param {Object} options
   * @param {AccessController} options.access The access controller instance
   * @param {number} options.length How many entries to include in the log
   * @param {number} options.timeout Maximum time to wait for each fetch operation, in ms
   * @param {function(cid, entry, parent, depth)} [options.onProgressCallback]
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @return {Promise<Log>} New Log
   */
  static async fromJSON (ipfs, identity, json,
    { access, length = -1, timeout, onProgressCallback, sortFn } = {}) {
    // TODO: need to verify the entries with 'key'
    const data = await LogIO.fromJSON(ipfs, json, { length, timeout, onProgressCallback })
    return new Log(ipfs, identity, { logId: data.id, access, entries: data.values, sortFn })
  }

  /**
   * Create a new log from an Entry instance.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Identity} identity The identity instance
   * @param {Entry|Array<Entry>} sourceEntries An Entry or an array of entries to fetch a log from
   * @param {Object} options
   * @param {AccessController} options.access The access controller instance
   * @param {number} options.length How many entries to include. Default: infinite.
   * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
   * @param {function(cid, entry, parent, depth)} [options.onProgressCallback]
   * @param {Function} options.sortFn The sort function - by default LastWriteWins
   * @return {Promise<Log>} New Log
   */
  static async fromEntry (ipfs, identity, sourceEntries,
    { access, length = -1, exclude, onProgressCallback, sortFn } = {}) {
    // TODO: need to verify the entries with 'key'
    const data = await LogIO.fromEntry(ipfs, sourceEntries,
      { length, exclude, onProgressCallback })
    return new Log(ipfs, identity, { logId: data.id, access, entries: data.values, sortFn })
  }

  /**
   * Find heads from a collection of entries.
   *
   * Finds entries that are the heads of this collection,
   * ie. entries that are not referenced by other entries.
   *
   * @param {Array<Entry>} entries Entries to search heads from
   * @returns {Array<Entry>}
   */
  static findHeads (entries) {
    var indexReducer = (res, entry, idx, arr) => {
      var addToResult = e => (res[e] = entry.cid)
      entry.next.forEach(addToResult)
      return res
    }

    var items = entries.reduce(indexReducer, {})

    var exists = e => items[e.cid] === undefined
    var compareIds = (a, b) => a.clock.id > b.clock.id

    return entries.filter(exists).sort(compareIds)
  }

  // Find entries that point to another entry that is not in the
  // input array
  static findTails (entries) {
    // Reverse index { next -> entry }
    var reverseIndex = {}
    // Null index containing entries that have no parents (nexts)
    var nullIndex = []
    // CIDs for all entries for quick lookups
    var cids = {}
    // CIDs of all next entries
    var nexts = []

    var addToIndex = (e) => {
      if (e.next.length === 0) {
        nullIndex.push(e)
      }
      var addToReverseIndex = (a) => {
        /* istanbul ignore else */
        if (!reverseIndex[a]) reverseIndex[a] = []
        reverseIndex[a].push(e)
      }

      // Add all entries and their parents to the reverse index
      e.next.forEach(addToReverseIndex)
      // Get all next references
      nexts = nexts.concat(e.next)
      // Get the cids of input entries
      cids[e.cid] = true
    }

    // Create our indices
    entries.forEach(addToIndex)

    var addUniques = (res, entries, idx, arr) => res.concat(findUniques(entries, 'cid'))
    var exists = e => cids[e] === undefined
    var findFromReverseIndex = e => reverseIndex[e]

    // Drop cids that are not in the input entries
    const tails = nexts // For every cid in nexts:
      .filter(exists) // Remove undefineds and nulls
      .map(findFromReverseIndex) // Get the Entry from the reverse index
      .reduce(addUniques, []) // Flatten the result and take only uniques
      .concat(nullIndex) // Combine with tails the have no next refs (ie. first-in-their-chain)

    return findUniques(tails, 'cid').sort(Entry.compare)
  }

  // Find the cids to entries that are not in a collection
  // but referenced by other entries
  static findTailCids (entries) {
    var cids = {}
    var addToIndex = e => (cids[e.cid] = true)
    var reduceTailCids = (res, entry, idx, arr) => {
      var addToResult = (e) => {
        /* istanbul ignore else */
        if (cids[e] === undefined) {
          res.splice(0, 0, e)
        }
      }
      entry.next.reverse().forEach(addToResult)
      return res
    }

    entries.forEach(addToIndex)
    return entries.reduce(reduceTailCids, [])
  }

  static difference (a, b) {
    let stack = Object.keys(a._headsIndex)
    let traversed = {}
    let res = {}

    const pushToStack = cid => {
      if (!traversed[cid] && !b.get(cid)) {
        stack.push(cid)
        traversed[cid] = true
      }
    }

    while (stack.length > 0) {
      const cid = stack.shift()
      const entry = a.get(cid)
      if (entry && !b.get(cid) && entry.id === b.id) {
        res[entry.cid] = entry
        traversed[entry.cid] = true
        entry.next.forEach(pushToStack)
      }
    }
    return res
  }
}

module.exports = Log
module.exports.AccessController = AccessController
