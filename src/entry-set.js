'use strict'

const GSet = require('./g-set')
const Entry = require('./entry')

const concatArrays = (res, val) => res.concat(val)

/**
 * EntrySet implements a G-Set CRDT
 *
 * From:
 * "A comprehensive study of Convergent and Commutative Replicated Data Types"
 * https://hal.inria.fr/inria-00555588
 */
// class EntrySet extends GSet {
class EntrySet {
  constructor (values) {
    this._values = values || []
  }

  get values () {
    return this._values
  }

  get heads () {
    return EntrySet.findHeads(this.values)
  }

  get tails () {
    return EntrySet.findTails(this.values)
  }

  get tailHashes () {
    return EntrySet.findTailHashes(this.values)
  }

  get keys () {
    return this._values.map(e => e.hash)
  }

  get length () {
    return this._values.length
  }

  append (value) {
    return new EntrySet(this.values.concat([value]))
  }

  has (entry) {
    var isEqual = e => Entry.isEqual(e, entry)
    return this.values.find(isEqual) !== undefined
  }

  get (hash) {
    var hashEquals = e => e.hash === hash
    return this.values.find(hashEquals)
  }

  sort () {
    return new EntrySet(this.values.sort(Entry.compare))
  }

  last (n = 1) {
    return n > -1 ? new EntrySet(this.values.slice(-n)) : new EntrySet(this.values)
  }

  slice (start, end) {
    return new EntrySet(this.values.slice(start || 0, end || this.values.length))
  }

  replaceInFront (withEntries) {
    var sliced = this.values.slice(withEntries.length, this.values.length)
    return new EntrySet(withEntries.values.concat(sliced))
  }

  clone () {
    return new EntrySet(this.values)
  }

  /**
   * Merge sets
   * @param  {EntrySet} set EntrySet merge with this set
   * @return {Array<Entry>} EntrySet with entries from this and set
   */
  merge (set) {
    var combined = []

    if (Array.isArray(set)) {
      combined = this.values.reduce(concatArrays, [])
    } else {
      combined = this.values.concat(set.values)
    }

    var uniques = EntrySet._uniques(combined)
    var newSet = new EntrySet(uniques)
    return newSet.sort()
  }

  /**
   * Find entries from the set that are not in the other set
   * @param  {EntrySet} b EntrySet
   * @return {Array<Entry>} Entries from b that are not in a
   */
  difference (b) {
    // Indices for quick lookups
    var processed = {}
    var existing = {}

    // Create an index of the first collection
    var addToIndex = e => existing[e.hash] = true
    this.values.forEach(addToIndex)

    // Reduce to entries that are not in the first collection
    var reducer = (res, entry) => {
      var isInFirst = existing[entry.hash] !== undefined
      var hasBeenProcessed = processed[entry.hash] !== undefined
      if (!isInFirst && !hasBeenProcessed) {
        res.push(entry)
        processed[entry.hash] = true
      }
      return res
    }

    var reduced = b.values.reduce(reducer, [])

    return new EntrySet(reduced)
  }

  /**
   * Find entries from the set hat are also in the other set
   * @param  {EntrySet} b EntrySet
   * @return {Array<Entry>} Entries from b that are in a
   */
  intersection (b) {
    // Indices for quick lookups
    var processed = {}
    var existing = {}

    // Create an index of the first collection
    var addToIndex = e => existing[e.hash] = true
    this.values.forEach(addToIndex)

    // Reduce to entries that are not in the first collection
    var reducer = (res, entry) => {
      var isInFirst = existing[entry.hash] !== undefined
      var hasBeenProcessed = processed[entry.hash] !== undefined
      if (isInFirst && !hasBeenProcessed) {
        res.push(entry)
        processed[entry.hash] = true
      }
      return res
    }

    var reduced = b.values.reduce(reducer, [])

    return new EntrySet(reduced)
  }

  /**
   * Check if a set is an EntrySet
   * @param  {Any} set Set to check
   * @return {Boolean} True is given set is an EntrySet
   */
  static isSet (set) {
    return set !== undefined
      && set.values !== undefined
      && Array.isArray(set.values)
  }

  /**
   * Sort entries
   *
   * @description
   * Sorts an array of Entry objects according to their clock
   *
   * @param {Array<Entry>} entries Entries to sort
   * @returns {Array<Entry>}
   */
  static sort (entries) {
    return entries.sort(Entry.compare)
  }

  /**
   * Check if a collection of entries contains an entry
   * @param  {Array<Entry>} entries Entries to check from
   * @param  {Entry} entry Entry to find
   * @return {boolean} Is the entry in collection
   */
  static has (entries, entry) {
    var isEqual = e => Entry.isEqual(e, entry)
    return entries.find(isEqual) !== undefined
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
    var compareIds = (a, b) => a.id > b.id

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

    var addUniques = (res, entries, idx, arr) => res.concat(EntrySet._uniques(entries))
    var exists = e => hashes[e] === undefined
    var findFromReverseIndex = e => reverseIndex[e]

    // Drop hashes that are not in the input entries
    const tails = nexts // For every multihash in nexts:
      .filter(exists) // Remove undefineds and nulls
      .map(findFromReverseIndex) // Get the Entry from the reverse index
      .reduce(addUniques, []) // Flatten the result and take only uniques
      .concat(nullIndex) // Combine with tails the have no next refs (ie. first-in-their-chain)

    return EntrySet._uniques(tails).sort(Entry.compare)
  }

  // Find the hashes to entries that are not in a collection but referenced by other entries
  static findTailHashes (entries) {
    var hashes = {}
    var addToIndex = (e) => hashes[e.hash] = true

    var reduceTailHashes = (res, entry, idx, arr) => {
      var addToResult = (e) => {
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

  /**
   * Find entry's children from an Array of entries
   *
   * @description
   * Returns entry's children as an Array up to the last know child.
   *
   * @param {Log} [log] Log to search parents from
   * @param {Entry} [entry] Entry for which to find the parents
   * @returns {Array<Entry>}
   */
  static findChildren (entries, entry) {
    var stack = []
    var parent = entries.find((e) => Entry.isParent(entry, e))
    var prev = entry
    while (parent) {
      stack.push(parent)
      prev = parent
      parent = entries.find((e) => Entry.isParent(prev, e))
    }
    stack = stack.sort((a, b) => a.seq > b.seq)
    return stack
  }

  /**
   * Reduce an Array of Entry objects to unique entries
   * @private
   * @param  {Array<Entry>} entries Entries to reduce
   * @return {Array<Entry>} Array of unique Entry objects
   */
  static _uniques (entries) {
    const contains = (entries, entry) => {
      var isEqual = e => Entry.isEqual(e, entry)
      return entries.find(isEqual) !== undefined
    }

    const reducer = (result, entry, idx, arr) => {
      if (!contains(result, entry)) {
        result.push(entry)
      }
      return result
    }

    return entries.reduce(reducer, [])
  }
}

module.exports = EntrySet
