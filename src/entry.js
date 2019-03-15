'use strict'

const Clock = require('./lamport-clock')
const { isDefined, io } = require('./utils')

const IPLD_LINKS = ['next']
const IpfsNotDefinedError = () => new Error('Ipfs instance not defined')
const getCidProp = (entry) => entry.v === 0 ? 'hash' : 'cid'

class Entry {
  /**
   * Create an Entry
   * @param {IPFS} ipfs An IPFS instance
   * @param {Identity} identity The identity instance
   * @param {string} logId The unique identifier for this log
   * @param {*} data Data of the entry to be added. Can be any JSON.stringifyable data
   * @param {Array<string|Entry>} [next=[]] Parent CIDs or entries
   * @param {LamportClock} [clock] The lamport clock
   * @returns {Promise<Entry>}
   * @example
   * const entry = await Entry.create(ipfs, identity, 'hello')
   * console.log(entry)
   * // { cid: null, payload: "hello", next: [] }
   */
  static async create (ipfs, identity, logId, data, next = [], clock) {
    if (!isDefined(ipfs)) throw IpfsNotDefinedError()
    if (!isDefined(identity)) throw new Error('Identity is required, cannot create entry')
    if (!isDefined(logId)) throw new Error('Entry requires an id')
    if (!isDefined(data)) throw new Error('Entry requires data')
    if (!isDefined(next) || !Array.isArray(next)) throw new Error("'next' argument is not an array")

    // Clean the next objects and convert to cids
    const toEntry = (e) => e.cid ? e.cid : e
    const nexts = next.filter(isDefined).map(toEntry)

    const entry = {
      cid: null, // "zd...Foo", we'll set the cid after persisting the entry
      id: logId, // For determining a unique chain
      payload: data, // Can be any JSON.stringifyable data
      next: nexts, // Array of CIDs
      v: 1, // To tag the version of this data structure
      clock: clock || new Clock(identity.publicKey)
    }

    const signature = await identity.provider.sign(identity, Entry.toBuffer(entry))

    entry.key = identity.publicKey
    entry.identity = identity.toJSON()
    entry.sig = signature
    entry.cid = await Entry.toCID(ipfs, entry)

    return Entry.ensureInterop(entry)
  }

  /**
   * Verifies an entry signature.
   *
   * @param {IdentityProvider} identityProvider The identity provider to use
   * @param {Entry} entry The entry being verified
   * @return {Promise} A promise that resolves to a boolean value indicating if the signature is valid
   */
  static async verify (identityProvider, entry) {
    if (!identityProvider) throw new Error('Identity-provider is required, cannot verify entry')
    if (!Entry.isEntry(entry)) throw new Error('Invalid Log entry')
    if (!entry.key) throw new Error("Entry doesn't have a key")
    if (!entry.sig) throw new Error("Entry doesn't have a signature")

    const e = {
      [getCidProp(entry)]: null,
      id: entry.id,
      payload: entry.payload,
      next: entry.next,
      v: entry.v,
      clock: entry.clock
    }

    return identityProvider.verify(entry.sig, entry.key, Entry.toBuffer(e))
  }

  /**
   * Transforms an entry into a Buffer.
   * @param {Entry} entry The entry
   * @return {Buffer} The buffer
   */
  static toBuffer (entry) {
    return Buffer.from(JSON.stringify(entry))
  }

  /**
   * Get the CID of an Entry.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Entry} entry Entry to get a CID for
   * @returns {Promise<string>}
   * @example
   * const cid = await Entry.toCID(ipfs, entry)
   * console.log(cid)
   * // "zd...Foo"
   */
  static toCID (ipfs, entry) {
    if (!ipfs) throw IpfsNotDefinedError()
    if (!Entry.isEntry(entry)) throw new Error('Invalid object format, cannot generate entry CID')

    // Ensure `entry` follows the correct format
    const e = {
      cid: null,
      id: entry.id,
      payload: entry.payload,
      next: entry.next,
      v: entry.v,
      clock: entry.clock
    }

    if (entry.key) Object.assign(e, { key: entry.key })
    if (entry.identity) Object.assign(e, { identity: entry.identity })
    if (entry.sig) Object.assign(e, { sig: entry.sig })

    return io.write(ipfs, 'dag-cbor', e, { links: IPLD_LINKS })
  }

  /**
   * Get the multihash of an Entry.
   * @param {IPFS} ipfs An IPFS instance
   * @param {Entry} entry Entry to get a multihash for
   * @returns {Promise<string>}
   * @example
   * const multihash = await Entry.toMultihash(ipfs, entry)
   * console.log(multihash)
   * // "Qm...Foo"
   * @deprecated
   */
  static async toMultihash (ipfs, entry) {
    if (!ipfs) throw IpfsNotDefinedError()
    if (!Entry.isEntry(entry)) throw new Error('Invalid object format, cannot generate entry CID')

    // Ensure `entry` follows the correct format
    const e = {
      hash: null,
      id: entry.id,
      payload: entry.payload,
      next: entry.next,
      v: 0,
      clock: entry.clock
    }

    if (entry.key) Object.assign(e, { key: entry.key })
    if (entry.identity) Object.assign(e, { identity: entry.identity })
    if (entry.sig) Object.assign(e, { sig: entry.sig })

    return io.write(ipfs, 'dag-pb', e, { links: IPLD_LINKS })
  }

  /**
   * Create an Entry from a CID.
   * @param {IPFS} ipfs An IPFS instance
   * @param {string} cid The CID to create an Entry from
   * @returns {Promise<Entry>}
   * @example
   * const entry = await Entry.fromCID(ipfs, "zd...Foo")
   * console.log(entry)
   * // { cid: "Zd...Foo", payload: "hello", next: [] }
   */
  static async fromCID (ipfs, cid) {
    if (!ipfs) throw IpfsNotDefinedError()
    if (!cid) throw new Error(`Invalid CID: ${cid}`)

    const e = await io.read(ipfs, cid, { links: IPLD_LINKS })

    let entry = {
      [getCidProp(e)]: cid,
      id: e.id,
      payload: e.payload,
      next: e.next,
      v: e.v,
      clock: new Clock(e.clock.id, e.clock.time)
    }

    if (e.key) Object.assign(entry, { key: e.key })
    if (e.identity) Object.assign(entry, { identity: e.identity })
    if (e.sig) Object.assign(entry, { sig: e.sig })

    return Entry.ensureInterop(entry)
  }

  /**
   * Create an Entry from a multihash.
   * @param {IPFS} ipfs An IPFS instance
   * @param {string} multihash Multihash (as a Base58 encoded string) to create the Entry from
   * @returns {Promise<Entry>}
   * @example
   * const entry = await Entry.fromMultihash(ipfs, "Qm...Foo")
   * console.log(entry)
   * // { cid: "Qm...Foo", payload: "hello", next: [] }
   * @deprecated
   */
  static async fromMultihash (ipfs, multihash) {
    return Entry.fromCID(ipfs, multihash)
  }

  /**
   * Check if an object is an Entry.
   * @param {Entry} obj
   * @returns {boolean}
   */
  static isEntry (obj) {
    return obj && obj.id !== undefined &&
      obj.next !== undefined &&
      obj.payload !== undefined &&
      obj.v !== undefined &&
      obj[getCidProp(obj)] !== undefined &&
      obj.clock !== undefined
  }

  /**
   * Ensures that this entry is interoperable between earlier versions
   * and the most recent one (and vice-versa).
   * @param {Entry} entry The entry to ensure interoperability
   * @return {Entry} entry The same entry but with backwards and forward interoperability
   */
  static ensureInterop (entry) {
    if (entry.cid && entry.hash) {
      return entry
    }

    const prop = getCidProp(entry)
    const accessorProp = prop === 'hash' ? 'cid' : 'hash'

    Object.defineProperty(entry, accessorProp, {
      get () {
        return this[prop]
      },
      set (value) {
        this[prop] = value
      }
    })

    return entry
  }

  /**
   * Compares two entries.
   * @param {Entry} a
   * @param {Entry} b
   * @returns {number} 1 if a is greater, -1 is b is greater
   */
  static compare (a, b) {
    var distance = Clock.compare(a.clock, b.clock)
    if (distance === 0) return a.clock.id < b.clock.id ? -1 : 1
    return distance
  }

  /**
   * Check if an entry equals another entry.
   * @param {Entry} a
   * @param {Entry} b
   * @returns {boolean}
   */
  static isEqual (a, b) {
    return a.cid === b.cid
  }

  /**
   * Check if an entry is a parent to another entry.
   * @param {Entry} entry1 Entry to check
   * @param {Entry} entry2 The parent Entry
   * @returns {boolean}
   */
  static isParent (entry1, entry2) {
    return entry2.next.indexOf(entry1.cid) > -1
  }

  /**
   * Find entry's children from an Array of entries.
   * Returns entry's children as an Array up to the last know child.
   * @param {Entry} entry Entry for which to find the parents
   * @param {Array<Entry>} values Entries to search parents from
   * @returns {Array<Entry>}
   */
  static findChildren (entry, values) {
    var stack = []
    var parent = values.find((e) => Entry.isParent(entry, e))
    var prev = entry
    while (parent) {
      stack.push(parent)
      prev = parent
      parent = values.find((e) => Entry.isParent(prev, e))
    }
    stack = stack.sort((a, b) => a.clock.time > b.clock.time)
    return stack
  }
}

module.exports = Entry
