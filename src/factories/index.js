const isDefined = require('../utils/is-defined')
const LogIO = require('../log-io')

const createLog = (ipfs, id, entries, heads, clock, acl, identity) => {
  if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError()
  if (!isDefined(id)) throw new Error('Log id is required, cannot create log')
  if (!isDefined(acl)) throw new Error('ACL is required, cannot create log')
  if (!isDefined(identity)) throw new Error('Identity is required, cannot create log')

  // NOTE: Avoid circular dependency
  return async (Log) => {
    const log = new Log(ipfs, id, entries, heads, clock, acl, identity)
    await log.validate(entries)
    return log
  }
}

/**
 * Create a log from multihash
 * @param {IPFS}   ipfs        An IPFS instance
 * @param {string} hash        Multihash (as a Base58 encoded string) to create the log from
 * @param {Number} [length=-1] How many items to include in the log
 * @param {Function(hash, entry, parent, depth)} onProgressCallback
 * @return {Promise<Log>}      New Log
 */
const createLogFromMultihash = async (ipfs, hash, length = -1, exclude, acl, identity, onProgressCallback, Log) => {
  if (!isDefined(hash)) throw new Error(`Invalid hash: "${hash}", cannot create log`)
  const { id, values: entries, heads, clock } = await LogIO.fromMultihash(ipfs, hash, length, exclude, onProgressCallback)
  return createLog(ipfs, id, entries, heads, clock, acl, identity)(Log)
}

/**
 * Create a log from a single entry's multihash
 * @param {IPFS}   ipfs        An IPFS instance
 * @param {string} hash        Multihash (as a Base58 encoded string) of the Entry from which to create the log from
 * @param {Number} [length=-1] How many entries to include in the log
 * @param {Function(hash, entry, parent, depth)} onProgressCallback
 * @return {Promise<Log>}      New Log
 */
const createLogFromEntryHash = async (ipfs, hash, id, length = -1, exclude, acl, identity, onProgressCallback, Log) => {
  if (!isDefined(hash)) throw new Error(`Invalid entry hash: "${hash}", cannot create log`)
  const { id: logId, values: entries } = await LogIO.fromEntryHash(ipfs, hash, id, length, exclude, onProgressCallback)
  return createLog(ipfs, id, entries, null, null, acl, identity)(Log)
}

/**
 * Create a log from a Log Snapshot JSON
 * @param {IPFS} ipfs          An IPFS instance
 * @param {Object} json        Log snapshot as JSON object
 * @param {Number} [length=-1] How many entries to include in the log
 * @param {Function(hash, entry, parent, depth)} [onProgressCallback]
 * @return {Promise<Log>}      New Log
 */
const createLogFromJSON = async (ipfs, json, length = -1, acl, identity, timeout, onProgressCallback, Log) => {
  if (!isDefined(json)) throw new Error('Invalid object, cannot create log')
  const { id, values: entries } = await LogIO.fromJSON(ipfs, json, length, timeout, onProgressCallback)
  return createLog(ipfs, id, entries, null, null, acl, identity)(Log)
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
const createLogFromEntry = async (ipfs, sourceEntries, length = -1, exclude, acl, identity, onProgressCallback, Log) => {
  if (!isDefined(sourceEntries)) throw new Error("Entries are required, cannot create log")
  const { id, values: entries } = await LogIO.fromEntry(ipfs, sourceEntries, length, exclude, onProgressCallback)
  return createLog(ipfs, id, entries, null, null, acl, identity)(Log)
}

module.exports = {
  createLogFromEntry,
  createLogFromEntryHash,
  createLogFromMultihash,
  createLogFromJSON
}
