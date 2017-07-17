'use strict'

const EntrySet = require('./entry-set')
const Clock = require('./lamport-clock')

const randomId = () => new Date().getTime()

/**
 * Log
 *
 * @description
 * The data structure that this module returns as
 * the result of operations on a log with functions
 * from LogUtils. Not meant to be used directly by the
 * users of this module, but rather used internally where
 * needed.
 */
class Log {
  constructor (id, entries, heads, clock) {
    this._id = id || randomId()
    this._clock = clock || new Clock(this.id)
    this._entries = entries || new EntrySet()
    this._heads = heads || this.entries.heads
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
   * Returns the items in the log
   * @returns {Array<Entry>}
   */
  get items () {
    return this.entries.values
  }

  /**
   * Returns the values in the log
   * @returns {Array<Entry>}
   */
  get values () {
    return this.entries.values
  }

  /**
   * Returns the items in the log as an EntrySet
   * @returns {EntrySet}
   */
  get entries () {
    return this._entries
  }

  /**
   * Returns an array of heads as multihashes
   * @returns {Array<string>}
   */
  get heads () {
    return this._heads
  }

  /**
   * Returns an array of Entry objects that reference entries which
   * are not in the log currently
   * @returns {Array<Entry>}
   */
  get tails () {
    return this.entries.tails
  }

  /**
   * Returns an array of multihashes that are referenced by entries which
   * are not in the log currently
   * @returns {Array<string>} Array of multihashes
   */
  get tailHashes () {
    return this.entries.tailHashes
  }

  /**
   * Returns the lenght of the log
   * @return {Number} Length
   */
  get length () {
    return this.entries.length
  }

  /**
   * Find an entry
   * @param {string} [hash] The Multihash of the entry as Base58 encoded string
   * @returns {Entry|undefined}
   */
  get (hash) {
    return this.entries.get(hash)
  }

  /**
   * Append an entry to the log
   * @param  {Entry} entry Entry to add
   * @return {Log} New Log containing the appended value
   */
  append (entry) {
    return new Log(this.id, this.entries.append(entry), [entry], this.clock)
  }

  /**
   * Get the log in JSON format
   * @returns {Object<{heads}>}
   */
  toJSON () {
    return { 
      id: this.id, 
      heads: this.heads.map(e => e.hash)
    }
  }

  toSnapshot () {
    return {
      id: this.id,
      heads: this.heads,
      entries: this.items,
    }
  }
  /**
   * Get the log as a Buffer
   * @returns {Buffer}
   */
  toBuffer () {
    return new Buffer(JSON.stringify(this.toJSON()))
  }

  /**
   * Returns the log entries as a formatted string
   * @example
   * two
   * └─one
   *   └─three
   * @returns {string}
   */
  toString () {
    return this.items
      .slice()
      .reverse()
      .map((e, idx) => {
        const parents = EntrySet.findChildren(this.entries.values, e)
        const len = parents.length
        let padding = new Array(Math.max(len - 1, 0))
        padding = len > 1 ? padding.fill('  ') : padding
        padding = len > 0 ? padding.concat(['└─']) : padding
        return padding.join('') + e.payload
      })
      .join('\n')
  }
}

module.exports = Log
