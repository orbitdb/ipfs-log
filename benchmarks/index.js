const append = require('./append.js')
const findHeads = require('./find-heads.js')
const fromEntry = require('./from-entry.js')
const fromEntryHash = require('./from-entry-hash.js')
const fromMultihash = require('./from-multihash.js')
const get = require('./get.js')
const has = require('./has.js')
const heads = require('./heads.js')
const join = require('./join.js')
const tailHashes = require('./tail-hashes.js')
const tails = require('./tails.js')
const toMultihash = require('./to-multihash.js')
const toString = require('./to-string.js')
const traverse = require('./traverse.js')
const values = require('./values.js')

module.exports = [
  ...append,
  ...findHeads,
  ...fromEntry,
  ...fromEntryHash,
  ...fromMultihash,
  ...get,
  ...has,
  ...heads,
  ...join,
  ...tailHashes,
  ...tails,
  ...toMultihash,
  ...toString,
  ...traverse,
  ...values
]
