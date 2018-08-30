'use strict';

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _values = require('babel-runtime/core-js/object/values');

var _values2 = _interopRequireDefault(_values);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var pMap = require('p-map');
var GSet = require('./g-set');
var Entry = require('./entry');
var LogIO = require('./log-io');
var LogError = require('./log-errors');
var Clock = require('./lamport-clock');
var isDefined = require('./utils/is-defined');
var isFunction = require('./utils/is-function');
var _uniques = require('./utils/uniques');
var AccessController = require('./default-access-controller');
var IdentityProvider = require('orbit-db-identity-provider');
var Keystore = require('orbit-db-keystore');
var randomId = function randomId() {
  return new Date().getTime().toString();
};
var getHash = function getHash(e) {
  return e.hash;
};
var flatMap = function flatMap(res, acc) {
  return res.concat(acc);
};
var getNextPointers = function getNextPointers(entry) {
  return entry.next;
};
var maxClockTimeReducer = function maxClockTimeReducer(res, acc) {
  return Math.max(res, acc.clock.time);
};
var uniqueEntriesReducer = function uniqueEntriesReducer(res, acc) {
  res[acc.hash] = acc;
  return res;
};

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

var Log = function (_GSet) {
  (0, _inherits3.default)(Log, _GSet);

  /**
   * Create a new Log instance
   * @param  {IPFS}           [ipfs]          An IPFS instance
   * @param  {Object}         [acl]           ACL following an interface that provides functions for checking permissions
   * @param  {Object}         [identity]      Identity following an interface that provides functions for verifying entries signature and signing entries
   * @param  {String}         [logId]            ID of the log
   * @param  {Array<Entry>}   [entries]       An Array of Entries from which to create the log
   * @param  {Array<Entry>}   [heads]         Set the heads of the log
   * @param  {Clock}          [clock]         Set the clock of the log
   * @return {Log}                            Log
   */
  function Log(ipfs, acl, identity, logId, entries, heads, clock) {
    (0, _classCallCheck3.default)(this, Log);

    if (!isDefined(ipfs)) {
      throw LogError.ImmutableDBNotDefinedError();
    }

    if (!isDefined(acl)) {
      throw new Error('ACL is required');
    }

    if (!isDefined(identity)) {
      throw new Error('Identity is required');
    }

    if (isDefined(entries) && !Array.isArray(entries)) {
      throw new Error('\'entries\' argument must be an array of Entry instances');
    }

    if (isDefined(heads) && !Array.isArray(heads)) {
      throw new Error('\'heads\' argument must be an array');
    }

    if (!isDefined(acl)) {
      throw new Error('Access controller is required');
    }

    if (!isDefined(identity)) {
      throw new Error('Identity is required');
    }

    var _this = (0, _possibleConstructorReturn3.default)(this, (Log.__proto__ || (0, _getPrototypeOf2.default)(Log)).call(this));

    _this._storage = ipfs;
    _this._id = logId || randomId();

    // ACL
    _this._acl = acl;
    // Identity
    _this._identity = identity;

    // Add entries to the internal cache
    entries = entries || [];
    _this._entryIndex = entries.reduce(uniqueEntriesReducer, {});

    // Set heads if not passed as an argument
    heads = heads || Log.findHeads(entries);
    _this._headsIndex = heads.reduce(uniqueEntriesReducer, {});

    // Index of all next pointers in this log
    _this._nextsIndex = {};
    entries.forEach(function (e) {
      return e.next.forEach(function (a) {
        return _this._nextsIndex[a] = e.hash;
      });
    });

    // Set the length, we calculate the length manually internally
    _this._length = entries ? entries.length : 0;

    // Set the clock
    var maxTime = Math.max(clock ? clock.time : 0, _this.heads.reduce(maxClockTimeReducer, 0));
    // Take the given key as the clock id is it's a Key instance,
    // otherwise if key was given, take whatever it is,
    // and if it was null, take the given id as the clock id
    // const clockId = this._identity ? this._identity.publicKey : this._id
    _this._clock = new Clock(_this._identity.publicKey, maxTime);
    return _this;
  }

  /**
   * Returns the ID of the log
   * @returns {string}
   */


  (0, _createClass3.default)(Log, [{
    key: 'get',


    /**
     * Find an entry
     * @param {string} [hash] The Multihash of the entry as Base58 encoded string
     * @returns {Entry|undefined}
     */
    value: function get(hash) {
      return this._entryIndex[hash];
    }
  }, {
    key: 'has',
    value: function has(entry) {
      return this._entryIndex[entry.hash || entry] !== undefined;
    }
  }, {
    key: 'traverse',
    value: function traverse(rootEntries, amount) {
      // console.log("traverse>", rootEntry)
      var stack = rootEntries.map(getNextPointers).reduce(flatMap, []);
      var traversed = {};
      var result = {};
      var count = 0;

      var addToStack = function addToStack(hash) {
        if (!result[hash] && !traversed[hash]) {
          stack.push(hash);
          traversed[hash] = true;
        }
      };

      var addRootHash = function addRootHash(rootEntry) {
        result[rootEntry.hash] = rootEntry.hash;
        traversed[rootEntry.hash] = true;
        count++;
      };

      rootEntries.forEach(addRootHash);

      while (stack.length > 0 && count < amount) {
        var hash = stack.shift();
        var entry = this.get(hash);
        if (entry) {
          count++;
          result[entry.hash] = entry.hash;
          traversed[entry.hash] = true;
          entry.next.forEach(addToStack);
        }
      }
      return result;
    }

    /**
     * Append an entry to the log
     * @param  {Entry} entry Entry to add
     * @return {Log}   New Log containing the appended value
     */

  }, {
    key: 'append',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(data) {
        var _this2 = this;

        var pointerCount = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1;
        var newTime, nexts, entry, canAppend;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                // Update the clock (find the latest clock)
                newTime = Math.max(this.clock.time, this.heads.reduce(maxClockTimeReducer, 0)) + 1;

                this._clock = new Clock(this.clock.id, newTime);

                // Get the required amount of hashes to next entries (as per current state of the log)
                nexts = (0, _keys2.default)(this.traverse(this.heads, pointerCount));

                // @TODO: Split Entry.create into creating object, checking permission, signing and then posting to IPFS
                // Create the entry and add it to the internal cache

                _context.next = 5;
                return Entry.create(this._storage, this._identity, this.id, data, nexts, this.clock);

              case 5:
                entry = _context.sent;
                _context.next = 8;
                return this._acl.canAppend(this._identity.id, entry);

              case 8:
                canAppend = _context.sent;

                if (canAppend) {
                  _context.next = 11;
                  break;
                }

                throw new Error('Could not append entry, key "' + this._identity.id + '" is not allowed to write to the log');

              case 11:

                this._entryIndex[entry.hash] = entry;
                nexts.forEach(function (e) {
                  return _this2._nextsIndex[e] = entry.hash;
                });
                this._headsIndex = {};
                this._headsIndex[entry.hash] = entry;
                // Update the length
                this._length++;
                return _context.abrupt('return', entry);

              case 17:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function append(_x2) {
        return _ref.apply(this, arguments);
      }

      return append;
    }()

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

  }, {
    key: 'join',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(log) {
        var _this3 = this;

        var size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
        var newItems, permitted, verify, entriesToJoin, addToNextsIndex, tmp, notReferencedByNewItems, notInCurrentNexts, nextsFromNewItems, mergedHeads, maxClock;
        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (isDefined(log)) {
                  _context4.next = 2;
                  break;
                }

                throw LogError.LogNotDefinedError();

              case 2:
                if (Log.isLog(log)) {
                  _context4.next = 4;
                  break;
                }

                throw LogError.NotALogError();

              case 4:

                // Get the difference of the logs
                newItems = Log.difference(log, this);

                // Verify if entries are allowed to be added to the log and throws if
                // there's an invalid entry

                permitted = function () {
                  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(entry) {
                    var canAppend;
                    return _regenerator2.default.wrap(function _callee2$(_context2) {
                      while (1) {
                        switch (_context2.prev = _context2.next) {
                          case 0:
                            _context2.next = 2;
                            return _this3._acl.canAppend(entry.key, entry);

                          case 2:
                            canAppend = _context2.sent;

                            if (canAppend) {
                              _context2.next = 5;
                              break;
                            }

                            throw new Error("Append not permitted");

                          case 5:
                          case 'end':
                            return _context2.stop();
                        }
                      }
                    }, _callee2, _this3);
                  }));

                  return function permitted(_x5) {
                    return _ref3.apply(this, arguments);
                  };
                }();

                // Verify signature for each entry and throws if there's an invalid signature


                verify = function () {
                  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(entry) {
                    var isValid;
                    return _regenerator2.default.wrap(function _callee3$(_context3) {
                      while (1) {
                        switch (_context3.prev = _context3.next) {
                          case 0:
                            _context3.next = 2;
                            return Entry.verify(_this3._identity.provider, entry);

                          case 2:
                            isValid = _context3.sent;

                            if (isValid) {
                              _context3.next = 5;
                              break;
                            }

                            throw new Error('Could not validate signature "' + entry.sig + '" for entry "' + entry.hash + '" and key "' + entry.key + '"');

                          case 5:
                          case 'end':
                            return _context3.stop();
                        }
                      }
                    }, _callee3, _this3);
                  }));

                  return function verify(_x6) {
                    return _ref4.apply(this, arguments);
                  };
                }();

                entriesToJoin = (0, _values2.default)(newItems);
                _context4.next = 10;
                return pMap(entriesToJoin, permitted, { concurrency: 1 });

              case 10:
                _context4.next = 12;
                return pMap(entriesToJoin, verify, { concurrency: 1 });

              case 12:

                // Update the internal entry index
                this._entryIndex = (0, _assign2.default)(this._entryIndex, newItems);

                // Update the internal next pointers index

                addToNextsIndex = function addToNextsIndex(e) {
                  return e.next.forEach(function (a) {
                    return _this3._nextsIndex[a] = e.hash;
                  });
                };

                (0, _values2.default)(newItems).forEach(addToNextsIndex);

                // Update the length
                this._length += (0, _values2.default)(newItems).length;

                // Slice to the requested size
                if (size > -1) {
                  tmp = this.values;

                  tmp = tmp.slice(-size);
                  this._entryIndex = tmp.reduce(uniqueEntriesReducer, {});
                  this._length = (0, _values2.default)(this._entryIndex).length;
                }

                // Merge the heads

                notReferencedByNewItems = function notReferencedByNewItems(e) {
                  return !nextsFromNewItems.find(function (a) {
                    return a === e.hash;
                  });
                };

                notInCurrentNexts = function notInCurrentNexts(e) {
                  return !_this3._nextsIndex[e.hash];
                };

                nextsFromNewItems = (0, _values2.default)(newItems).map(getNextPointers).reduce(flatMap, []);
                mergedHeads = Log.findHeads((0, _values2.default)((0, _assign2.default)({}, this._headsIndex, log._headsIndex))).filter(notReferencedByNewItems).filter(notInCurrentNexts).reduce(uniqueEntriesReducer, {});


                this._headsIndex = mergedHeads;

                // Find the latest clock from the heads
                maxClock = (0, _values2.default)(this._headsIndex).reduce(maxClockTimeReducer, 0);

                this._clock = new Clock(this.clock.id, Math.max(this.clock.time, maxClock));
                return _context4.abrupt('return', this);

              case 25:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function join(_x4) {
        return _ref2.apply(this, arguments);
      }

      return join;
    }()

    /**
     * Get the log in JSON format
     * @returns {Object<{heads}>}
     */

  }, {
    key: 'toJSON',
    value: function toJSON() {
      return {
        id: this.id,
        heads: this.heads.map(getHash)
      };
    }
  }, {
    key: 'toSnapshot',
    value: function toSnapshot() {
      return {
        id: this.id,
        heads: this.heads,
        values: this.values
      };
    }
    /**
     * Get the log as a Buffer
     * @returns {Buffer}
     */

  }, {
    key: 'toBuffer',
    value: function toBuffer() {
      return Buffer.from((0, _stringify2.default)(this.toJSON()));
    }

    /**
     * Returns the log entries as a formatted string
     * @example
     * two
     * └─one
     *   └─three
     * @returns {string}
     */

  }, {
    key: 'toString',
    value: function toString(payloadMapper) {
      var _this4 = this;

      return this.values.slice().reverse().map(function (e, idx) {
        var parents = Entry.findChildren(e, _this4.values);
        var len = parents.length;
        var padding = new Array(Math.max(len - 1, 0));
        padding = len > 1 ? padding.fill('  ') : padding;
        padding = len > 0 ? padding.concat(['└─']) : padding;
        return padding.join('') + (payloadMapper ? payloadMapper(e.payload) : e.payload);
      }).join('\n');
    }

    /**
     * Check whether an object is a Log instance
     * @param {Object} log An object to check
     * @returns {true|false}
     */

  }, {
    key: 'toMultihash',


    /**
     * Get the log's multihash
     * @returns {Promise<string>} Multihash of the Log as Base58 encoded string
     */
    value: function toMultihash() {
      return LogIO.toMultihash(this._storage, this);
    }

    /**
     * Create a log from multihash
     * @param {IPFS}   ipfs        An IPFS instance
     * @param {string} hash        Multihash (as a Base58 encoded string) to create the log from
     * @param {Number} [length=-1] How many items to include in the log
     * @param {Function(hash, entry, parent, depth)} onProgressCallback
     * @return {Promise<Log>}      New Log
     */

  }, {
    key: 'id',
    get: function get() {
      return this._id;
    }

    /**
     * Returns the clock of the log
     * @returns {string}
     */

  }, {
    key: 'clock',
    get: function get() {
      return this._clock;
    }

    /**
     * Returns the length of the log
     * @return {Number} Length
     */

  }, {
    key: 'length',
    get: function get() {
      return this._length;
    }

    /**
     * Returns the values in the log
     * @returns {Array<Entry>}
     */

  }, {
    key: 'values',
    get: function get() {
      return (0, _values2.default)(this._entryIndex).sort(Entry.compare) || [];
    }

    /**
     * Returns an array of heads as multihashes
     * @returns {Array<string>}
     */

  }, {
    key: 'heads',
    get: function get() {
      return (0, _values2.default)(this._headsIndex) || [];
    }

    /**
     * Returns an array of Entry objects that reference entries which
     * are not in the log currently
     * @returns {Array<Entry>}
     */

  }, {
    key: 'tails',
    get: function get() {
      return Log.findTails(this.values);
    }

    /**
     * Returns an array of multihashes that are referenced by entries which
     * are not in the log currently
     * @returns {Array<string>} Array of multihashes
     */

  }, {
    key: 'tailHashes',
    get: function get() {
      return Log.findTailHashes(this.values);
    }
  }], [{
    key: 'isLog',
    value: function isLog(log) {
      return log.id !== undefined && log.heads !== undefined && log._entryIndex !== undefined;
    }
  }, {
    key: 'fromMultihash',
    value: function fromMultihash(ipfs, acl, identity, hash) {
      var length = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : -1;
      var exclude = arguments[5];
      var onProgressCallback = arguments[6];

      if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError();
      if (!isDefined(hash)) throw new Error('Invalid hash: ' + hash);

      // TODO: need to verify the entries with 'key'
      // TODO: Change these to use await
      return LogIO.fromMultihash(ipfs, hash, length, exclude, onProgressCallback).then(function (data) {
        return new Log(ipfs, acl, identity, data.id, data.values, data.heads, data.clock);
      });
    }

    /**
     * Create a log from a single entry's multihash
     * @param {IPFS}   ipfs        An IPFS instance
     * @param {string} hash        Multihash (as a Base58 encoded string) of the Entry from which to create the log from
     * @param {Number} [length=-1] How many entries to include in the log
     * @param {Function(hash, entry, parent, depth)} onProgressCallback
     * @return {Promise<Log>}      New Log
     */

  }, {
    key: 'fromEntryHash',
    value: function fromEntryHash(ipfs, acl, identity, hash, id) {
      var length = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : -1;
      var exclude = arguments[6];
      var onProgressCallback = arguments[7];

      if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError();
      if (!isDefined(hash)) throw new Error("'hash' must be defined");

      // TODO: need to verify the entries with 'key'
      return LogIO.fromEntryHash(ipfs, hash, id, length, exclude, onProgressCallback).then(function (data) {
        return new Log(ipfs, acl, identity, id, data.values);
      });
    }

    /**
     * Create a log from a Log Snapshot JSON
     * @param {IPFS} ipfs          An IPFS instance
     * @param {Object} json        Log snapshot as JSON object
     * @param {Number} [length=-1] How many entries to include in the log
     * @param {Function(hash, entry, parent, depth)} [onProgressCallback]
     * @return {Promise<Log>}      New Log
     */

  }, {
    key: 'fromJSON',
    value: function fromJSON(ipfs, json) {
      var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
      var acl = arguments[3];
      var identity = arguments[4];
      var timeout = arguments[5];
      var onProgressCallback = arguments[6];

      if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError();

      // TODO: need to verify the entries with 'key'
      return LogIO.fromJSON(ipfs, json, length, timeout, onProgressCallback).then(function (data) {
        return new Log(ipfs, data.id, data.values, null, null, acl, identity);
      });
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

  }, {
    key: 'fromEntry',
    value: function fromEntry(ipfs, acl, identity, sourceEntries) {
      var length = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : -1;
      var exclude = arguments[5];
      var onProgressCallback = arguments[6];

      if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError();
      if (!isDefined(sourceEntries)) throw new Error("'sourceEntries' must be defined");

      // TODO: need to verify the entries with 'key'
      return LogIO.fromEntry(ipfs, sourceEntries, length, exclude, onProgressCallback).then(function (data) {
        return new Log(ipfs, acl, identity, data.id, data.values);
      });
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

  }, {
    key: 'findHeads',
    value: function findHeads(entries) {
      var indexReducer = function indexReducer(res, entry, idx, arr) {
        var addToResult = function addToResult(e) {
          return res[e] = entry.hash;
        };
        entry.next.forEach(addToResult);
        return res;
      };

      var items = entries.reduce(indexReducer, {});

      var exists = function exists(e) {
        return items[e.hash] === undefined;
      };
      var compareIds = function compareIds(a, b) {
        return a.clock.id > b.clock.id;
      };

      return entries.filter(exists).sort(compareIds);
    }

    // Find entries that point to another entry that is not in the
    // input array

  }, {
    key: 'findTails',
    value: function findTails(entries) {
      // Reverse index { next -> entry }
      var reverseIndex = {};
      // Null index containing entries that have no parents (nexts)
      var nullIndex = [];
      // Hashes for all entries for quick lookups
      var hashes = {};
      // Hashes of all next entries
      var nexts = [];

      var addToIndex = function addToIndex(e) {
        if (e.next.length === 0) {
          nullIndex.push(e);
        }
        var addToReverseIndex = function addToReverseIndex(a) {
          /* istanbul ignore else */
          if (!reverseIndex[a]) reverseIndex[a] = [];
          reverseIndex[a].push(e);
        };

        // Add all entries and their parents to the reverse index
        e.next.forEach(addToReverseIndex);
        // Get all next references
        nexts = nexts.concat(e.next);
        // Get the hashes of input entries
        hashes[e.hash] = true;
      };

      // Create our indices
      entries.forEach(addToIndex);

      var addUniques = function addUniques(res, entries, idx, arr) {
        return res.concat(_uniques(entries, 'hash'));
      };
      var exists = function exists(e) {
        return hashes[e] === undefined;
      };
      var findFromReverseIndex = function findFromReverseIndex(e) {
        return reverseIndex[e];
      };

      // Drop hashes that are not in the input entries
      var tails = nexts // For every multihash in nexts:
      .filter(exists) // Remove undefineds and nulls
      .map(findFromReverseIndex) // Get the Entry from the reverse index
      .reduce(addUniques, []) // Flatten the result and take only uniques
      .concat(nullIndex); // Combine with tails the have no next refs (ie. first-in-their-chain)

      return _uniques(tails, 'hash').sort(Entry.compare);
    }

    // Find the hashes to entries that are not in a collection
    // but referenced by other entries

  }, {
    key: 'findTailHashes',
    value: function findTailHashes(entries) {
      var hashes = {};
      var addToIndex = function addToIndex(e) {
        return hashes[e.hash] = true;
      };

      var reduceTailHashes = function reduceTailHashes(res, entry, idx, arr) {
        var addToResult = function addToResult(e) {
          /* istanbul ignore else */
          if (hashes[e] === undefined) {
            res.splice(0, 0, e);
          }
        };
        entry.next.reverse().forEach(addToResult);
        return res;
      };

      entries.forEach(addToIndex);
      return entries.reduce(reduceTailHashes, []);
    }
  }, {
    key: 'difference',
    value: function difference(a, b) {
      var stack = (0, _keys2.default)(a._headsIndex);
      var traversed = {};
      var res = {};

      var pushToStack = function pushToStack(hash) {
        if (!traversed[hash] && !b.get(hash)) {
          stack.push(hash);
          traversed[hash] = true;
        }
      };

      while (stack.length > 0) {
        var hash = stack.shift();
        var entry = a.get(hash);
        if (entry && !b.get(hash) && entry.id === b.id) {
          res[entry.hash] = entry;
          traversed[entry.hash] = true;
          entry.next.forEach(pushToStack);
        }
      }
      return res;
    }
  }]);
  return Log;
}(GSet);

module.exports = Log;
module.exports.AccessController = AccessController;
module.exports.IdentityProvider = IdentityProvider;
module.exports.Keystore = Keystore;