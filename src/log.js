'use strict'

const pMap = require('p-map')
const GSet = require('./g-set')
const Entry = require('./entry')
const LogIO = require('./log-io')
const LogError = require('./log-errors')
const Clock = require('./lamport-clock')
const isDefined = require('./utils/is-defined')
const isFunction = require('./utils/is-function')
const _uniques = require('./utils/uniques')
const EntryValidator = require('./validator')

const randomId = () => new Date().getTime().toString()
const getHash = e => e.hash
const flatMap = (res, acc) => res.concat(acc)
const getNextPointers = entry => entry.next
const maxClockTimeReducer = (res, acc) => Math.max(res, acc.clock.time)
const uniqueEntriesReducer = (res, acc) => {
  res[acc.hash] = acc
  return res
}

/**
 * Log
 *
 * @description
 * Log implements a G-Set CRDT and adds ordering
 *
 * From:
 * "A comprehensive study of Convergent and Commutative Replicated Data Types"
 * https://hal.inria.fr/inria-00555588
 */
class Log extends GSet {
  /**
   * Create a new Log instance
   * @param  {IPFS}           ipfs            An IPFS instance
   * @param  {String}         [id]            ID of the log
   * @param  {Array<Entry>}   [entries]       An Array of Entries from which to create the log from
   * @param  {Array<Entry>}   [heads]         Set the heads of the log
   * @param  {Clock}          [clock]         Set the clock of the log
   * be joined. The arguments will be the entry to verify and a reference
   * to the log itself and the verification function should return true
   * if the entry is valid and false if it is not. Logs containing entries
   * marked as invalid by this function will not be joined
   * @param {Object}          [validator]     Validator following an interface
   * that provides functions for signing and verifying entries and a publicKey
   * to be used as a fallback to the clockId
   * @return {Log}                            Log
   */
  constructor (ipfs, id, entries, heads, clock, validator) {
    // TODO: We have to simplify this constructor and get an "options" object or something like this
    if (!isDefined(ipfs)) {
      throw LogError.ImmutableDBNotDefinedError()
    }

    if (isDefined(entries) && !Array.isArray(entries)) {
      throw new Error(`'entries' argument must be an array of Entry instances`)
    }

    if (isDefined(heads) && !Array.isArray(heads)) {
      throw new Error(`'heads' argument must be an array`)
    }

    if (!isDefined(validator)) {
      throw new Error('Validator is required')
    }

    super()

    this._storage = ipfs
    this._id = id || randomId()

    // Entry validator
    this._entryValidator = new EntryValidator(validator)

    // Add entries to the internal cache
    entries = entries || []
    this._entryIndex = entries.reduce(uniqueEntriesReducer, {})

    // Set heads if not passed as an argument
    heads = heads || Log.findHeads(entries)
    this._headsIndex = heads.reduce(uniqueEntriesReducer, {})

    // Index of all next pointers in this log
    this._nextsIndex = {}
    entries.forEach(e => e.next.forEach(a => this._nextsIndex[a] = e.hash))

    // Set the length, we calculate the length manually internally
    this._length = entries ? entries.length : 0

    // Set the clock
    const maxTime = Math.max(clock ? clock.time : 0, this.heads.reduce(maxClockTimeReducer, 0))
    // Take the given key as the clock id is it's a Key instance,
    // otherwise if key was given, take whatever it is,
    // and if it was null, take the given id as the clock id
    const clockId = this._entryValidator ? this._entryValidator.publicKey : this._id
    this._clock = new Clock(clockId, maxTime)
  }

  /**
   * Returns the ID of the log
   * @returns {string}
   */
  get id () {
    return this._id
  }

  /**
   * Returns the clock of the log
   * @returns {string}
   */
  get clock () {
    return this._clock
  }

  /**
   * Returns the length of the log
   * @return {Number} Length
   */
  get length () {
    return this._length
  }

  /**
   * Returns the values in the log
   * @returns {Array<Entry>}
   */
  get values () {
    return Object.values(this._entryIndex).sort(Entry.compare) || []
  }

  /**
   * Returns an array of heads as multihashes
   * @returns {Array<string>}
   */
  get heads () {
    return Object.values(this._headsIndex) || []
  }

  /**
   * Returns an array of Entry objects that reference entries which
   * are not in the log currently
   * @returns {Array<Entry>}
   */
  get tails () {
    return Log.findTails(this.values)
  }

  /**
   * Returns an array of multihashes that are referenced by entries which
   * are not in the log currently
   * @returns {Array<string>} Array of multihashes
   */
  get tailHashes () {
    return Log.findTailHashes(this.values)
  }

  /**
   * Find an entry
   * @param {string} [hash] The Multihash of the entry as Base58 encoded string
   * @returns {Entry|undefined}
   */
  get (hash) {
    return this._entryIndex[hash]
  }

  has (entry) {
    return this._entryIndex[entry.hash || entry] !== undefined
  }

  traverse (rootEntries, amount) {
    // console.log("traverse>", rootEntry)
    let stack = rootEntries.map(getNextPointers).reduce(flatMap, [])
    let traversed = {}
    let result = {}
    let count = 0

    const addToStack = hash => {
      if (!result[hash] && !traversed[hash]) {
        stack.push(hash)
        traversed[hash] = true
      }
    }

    const addRootHash = rootEntry => {
      result[rootEntry.hash] = rootEntry.hash
      traversed[rootEntry.hash] = true
      count ++
    }

    rootEntries.forEach(addRootHash)

    while (stack.length > 0 && count < amount) {
      const hash = stack.shift()
      const entry = this.get(hash)
      if (entry) {
        count ++
        result[entry.hash] = entry.hash
        traversed[entry.hash] = true
        entry.next.forEach(addToStack)
      }
    }
    return result
  }

  /**
   * Append an entry to the log
   * @param  {Entry} entry Entry to add
   * @return {Log}   New Log containing the appended value
   */
  async append (data, pointerCount = 1) {
    // Update the clock (find the latest clock)
    const newTime = Math.max(this.clock.time, this.heads.reduce(maxClockTimeReducer, 0)) + 1
    this._clock = new Clock(this.clock.id, newTime)
    // Get the required amount of hashes to next entries (as per current state of the log)
    const nexts = Object.keys(this.traverse(this.heads, pointerCount))
    // Create the entry and add it to the internal cache
    const entry = await Entry.create(this._storage, this._entryValidator, this.id, data, nexts, this.clock)
    this._entryIndex[entry.hash] = entry
    nexts.forEach(e => this._nextsIndex[e] = entry.hash)
    this._headsIndex = {}
    this._headsIndex[entry.hash] = entry
    // Update the length
    this._length ++
    return entry
  }

  /**
   * Join two logs
   *
   * @description Joins two logs returning a new log. Doesn't mutate the original logs.
   *
   * @param {IPFS}   [ipfs] An IPFS instance
   * @param {Log}    log    Log to join with this Log
   * @param {Number} [size] Max size of the joined log
   * @param {string} [id]   ID to use for the new log
   *
   * @example
   * log1.join(log2)
   *
   * @returns {Promise<Log>}
   */
  async join (log, size = -1) {
    if (!isDefined(log)) throw LogError.LogNotDefinedError()
    if (!Log.isLog(log)) throw LogError.NotALogError()

    // Get the difference of the logs
    const newItems = Log.difference(log, this)

    // Verify that all new entries can be joined with this log, throws an error if fails
    const verify = async (entry) => await Entry.verify(entry, this._entryValidator)
    await pMap(Object.values(newItems), verify, { concurrency: 1 })

    // Update the internal entry index
    this._entryIndex = Object.assign(this._entryIndex, newItems)

    // Update the internal next pointers index
    const addToNextsIndex = e => e.next.forEach(a => this._nextsIndex[a] = e.hash)
    Object.values(newItems).forEach(addToNextsIndex)

    // Update the length
    this._length += Object.values(newItems).length

    // Slice to the requested size
    if (size > -1) {
      let tmp = this.values
      tmp = tmp.slice(-size)
      this._entryIndex = tmp.reduce(uniqueEntriesReducer, {})
      this._length = Object.values(this._entryIndex).length
    }

    // Merge the heads
    const notReferencedByNewItems = e => !nextsFromNewItems.find(a => a === e.hash)
    const notInCurrentNexts = e => !this._nextsIndex[e.hash]
    const nextsFromNewItems = Object.values(newItems).map(getNextPointers).reduce(flatMap, [])
    const mergedHeads = Log.findHeads(Object.values(Object.assign({}, this._headsIndex, log._headsIndex)))
      .filter(notReferencedByNewItems)
      .filter(notInCurrentNexts)
      .reduce(uniqueEntriesReducer, {})

    this._headsIndex = mergedHeads

    // Find the latest clock from the heads
    const maxClock = Object.values(this._headsIndex).reduce(maxClockTimeReducer, 0)
    this._clock = new Clock(this.clock.id, Math.max(this.clock.time, maxClock))
    return this
  }

  /**
   * Get the log in JSON format
   * @returns {Object<{heads}>}
   */
  toJSON () {
    return {
      id: this.id,
      heads: this.heads.map(getHash)
    }
  }

  toSnapshot () {
    return {
      id: this.id,
      heads: this.heads,
      values: this.values,
    }
  }
  /**
   * Get the log as a Buffer
   * @returns {Buffer}
   */
  toBuffer () {
    return Buffer.from(JSON.stringify(this.toJSON()))
  }

  /**
   * Returns the log entries as a formatted string
   * @example
   * two
   * └─one
   *   └─three
   * @returns {string}
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
        return padding.join('') + (payloadMapper ? payloadMapper(e.payload) : e.payload)
      })
      .join('\n')
  }

  /**
   * Check whether an object is a Log instance
   * @param {Object} log An object to check
   * @returns {true|false}
   */
  static isLog (log) {
    return log.id !== undefined
      && log.heads !== undefined
      && log._entryIndex !== undefined
  }

  /**
   * Get the log's multihash
   * @returns {Promise<string>} Multihash of the Log as Base58 encoded string
   */
  toMultihash () {
    return LogIO.toMultihash(this._storage, this)
  }

  /**
   * Create a log from multihash
   * @param {IPFS}   ipfs        An IPFS instance
   * @param {string} hash        Multihash (as a Base58 encoded string) to create the log from
   * @param {Number} [length=-1] How many items to include in the log
   * @param {Function(hash, entry, parent, depth)} onProgressCallback
   * @return {Promise<Log>}      New Log
   */
  static fromMultihash (ipfs, hash, length = -1, exclude, entryValidator, onProgressCallback) {
    if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(hash)) throw new Error(`Invalid hash: ${hash}`)

    // TODO: need to verify the entries with 'key'
    return LogIO.fromMultihash(ipfs, hash, length, exclude, onProgressCallback)
      .then((data) => new Log(ipfs, data.id, data.values, data.heads, data.clock, entryValidator))
  }

  /**
   * Create a log from a single entry's multihash
   * @param {IPFS}   ipfs        An IPFS instance
   * @param {string} hash        Multihash (as a Base58 encoded string) of the Entry from which to create the log from
   * @param {Number} [length=-1] How many entries to include in the log
   * @param {Function(hash, entry, parent, depth)} onProgressCallback
   * @return {Promise<Log>}      New Log
   */
  static fromEntryHash (ipfs, hash, id, length = -1, exclude, entryValidator, onProgressCallback) {
    if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(hash)) throw new Error("'hash' must be defined")

    // TODO: need to verify the entries with 'key'
    return LogIO.fromEntryHash(ipfs, hash, id, length, exclude, onProgressCallback)
      .then((data) => new Log(ipfs, id, data.values, null, null, entryValidator))
  }

  /**
   * Create a log from a Log Snapshot JSON
   * @param {IPFS} ipfs          An IPFS instance
   * @param {Object} json        Log snapshot as JSON object
   * @param {Number} [length=-1] How many entries to include in the log
   * @param {Function(hash, entry, parent, depth)} [onProgressCallback]
   * @return {Promise<Log>}      New Log
   */
  static fromJSON (ipfs, json, length = -1, entryValidator, timeout, onProgressCallback) {
    if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError()

    // TODO: need to verify the entries with 'key'
    return LogIO.fromJSON(ipfs, json, length, timeout, onProgressCallback)
      .then((data) => new Log(ipfs, data.id, data.values, null, null, entryValidator))
  }

  /**
   * Create a new log from an Entry instance
   * @param {IPFS}                ipfs          An IPFS instance
   * @param {Entry|Array<Entry>}  sourceEntries An Entry or an array of entries to fetch a log from
   * @param {Number}              [length=-1]   How many entries to include. Default: infinite.
   * @param {Array<Entry|string>} [exclude]     Array of entries or hashes or entries to not fetch (foe eg. cached entries)
   * @param {Function(hash, entry, parent, depth)} [onProgressCallback]
   * @return {Promise<Log>}       New Log
   */
  static fromEntry (ipfs, sourceEntries, length = -1, exclude, entryValidator, onProgressCallback) {
    if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError()
    if (!isDefined(sourceEntries)) throw new Error("'sourceEntries' must be defined")

    // TODO: need to verify the entries with 'key'
    return LogIO.fromEntry(ipfs, sourceEntries, length, exclude, onProgressCallback)
      .then((data) => new Log(ipfs, data.id, data.values, null, null, entryValidator))
  }

  /**
   * Find heads from a collection of entries
   *
   * @description
   * Finds entries that are the heads of this collection,
   * ie. entries that are not referenced by other entries
   *
   * @param {Array<Entry>} Entries to search heads from
   * @returns {Array<Entry>}
   */
  static findHeads (entries) {
    var indexReducer = (res, entry, idx, arr) => {
      var addToResult = e => res[e] = entry.hash
      entry.next.forEach(addToResult)
      return res
    }

    var items = entries.reduce(indexReducer, {})

    var exists = e => items[e.hash] === undefined
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
    // Hashes for all entries for quick lookups
    var hashes = {}
    // Hashes of all next entries
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
      // Get the hashes of input entries
      hashes[e.hash] = true
    }

    // Create our indices
    entries.forEach(addToIndex)

    var addUniques = (res, entries, idx, arr) => res.concat(_uniques(entries, 'hash'))
    var exists = e => hashes[e] === undefined
    var findFromReverseIndex = e => reverseIndex[e]

    // Drop hashes that are not in the input entries
    const tails = nexts // For every multihash in nexts:
      .filter(exists) // Remove undefineds and nulls
      .map(findFromReverseIndex) // Get the Entry from the reverse index
      .reduce(addUniques, []) // Flatten the result and take only uniques
      .concat(nullIndex) // Combine with tails the have no next refs (ie. first-in-their-chain)

    return _uniques(tails, 'hash').sort(Entry.compare)
  }

  // Find the hashes to entries that are not in a collection
  // but referenced by other entries
  static findTailHashes (entries) {
    var hashes = {}
    var addToIndex = (e) => hashes[e.hash] = true

    var reduceTailHashes = (res, entry, idx, arr) => {
      var addToResult = (e) => {
        /* istanbul ignore else */
        if (hashes[e] === undefined) {
          res.splice(0, 0, e)
        }
      }
      entry.next.reverse().forEach(addToResult)
      return res
    }

    entries.forEach(addToIndex)
    return entries.reduce(reduceTailHashes, [])
  }

  static difference (a, b) {
    let stack = Object.keys(a._headsIndex)
    let traversed = {}
    let res = {}

    const pushToStack = hash => {
      if (!traversed[hash] && !b.get(hash)) {
        stack.push(hash)
        traversed[hash] = true
      }
    }

    while (stack.length > 0) {
      const hash = stack.shift()
      const entry = a.get(hash)
        if (entry && !b.get(hash) && entry.id === b.id) {
        res[entry.hash] = entry
        traversed[entry.hash] = true
        entry.next.forEach(pushToStack)
      }
    }
    return res
  }
}

module.exports = Log
