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
var _uniques = require('./utils/uniques');

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
   * @param  {IPFS}           ipfs            An IPFS instance
   * @param  {String}         [id]            ID of the log
   * @param  {Array<Entry>}   [entries]       An Array of Entries from which to create the log from
   * @param  {Array<Entry>}   [heads]         Set the heads of the log
   * @param  {Clock}          [clock]         Set the clock of the log
   * be joined. The arguments will be the entry to verify and a reference
   * to the log itself and the verification function should return true
   * if the entry is valid and false if it is not. Logs containing entries
   * marked as invalid by this function will not be joined
   * @return {Log}                            Log
   */
  function Log(ipfs, id, entries, heads, clock, acl) {
    (0, _classCallCheck3.default)(this, Log);

    if (!isDefined(ipfs)) {
      throw LogError.ImmutableDBNotDefinedError();
    }

    if (isDefined(entries) && !Array.isArray(entries)) {
      throw new Error('\'entries\' argument must be an array of Entry instances');
    }

    if (isDefined(heads) && !Array.isArray(heads)) {
      throw new Error('\'heads\' argument must be an array');
    }

    var _this = (0, _possibleConstructorReturn3.default)(this, (Log.__proto__ || (0, _getPrototypeOf2.default)(Log)).call(this));

    _this._storage = ipfs;
    _this._id = id || randomId

    // Access Controller
    ();_this._acl = acl;

    // Add entries to the internal cache
    entries = entries || [];
    _this._entryIndex = entries.reduce(uniqueEntriesReducer, {}

    // Set heads if not passed as an argument
    );heads = heads || Log.findHeads(entries);
    _this._headsIndex = heads.reduce(uniqueEntriesReducer, {}

    // Index of all next pointers in this log
    );_this._nextsIndex = {};
    entries.forEach(function (e) {
      return e.next.forEach(function (a) {
        return _this._nextsIndex[a] = e.hash;
      });
    }

    // Set the length, we calculate the length manually internally
    );_this._length = entries ? entries.length : 0;

    // Set the clock
    var maxTime = Math.max(clock ? clock.time : 0, _this.heads.reduce(maxClockTimeReducer, 0)
    // Take the given key as the clock id is it's a Key instance,
    // otherwise if key was given, take whatever it is,
    // and if it was null, take the given id as the clock id
    );var clockId = _this._acl ? _this._acl.getPublicSigningKey('hex') : _this._id;
    _this._clock = new Clock(clockId, maxTime);
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
        var newTime, nexts, entry;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                // Update the clock (find the latest clock)
                newTime = Math.max(this.clock.time, this.heads.reduce(maxClockTimeReducer, 0)) + 1;

                this._clock = new Clock(this.clock.id, newTime);
                // Get the required amount of hashes to next entries (as per current state of the log)
                nexts = (0, _keys2.default)(this.traverse(this.heads, pointerCount)
                // Create the entry and add it to the internal cache
                );
                _context.next = 5;
                return Entry.create(this._storage, this._acl, this.id, data, nexts, this.clock);

              case 5:
                entry = _context.sent;

                this._entryIndex[entry.hash] = entry;
                nexts.forEach(function (e) {
                  return _this2._nextsIndex[e] = entry.hash;
                });
                this._headsIndex = {};
                this._headsIndex[entry.hash] = entry;
                // Update the length
                this._length++;
                return _context.abrupt('return', entry);

              case 12:
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
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(log) {
        var _this3 = this;

        var size = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : -1;
        var newItems, verify, addToNextsIndex, tmp, notReferencedByNewItems, notInCurrentNexts, nextsFromNewItems, mergedHeads, maxClock;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (isDefined(log)) {
                  _context3.next = 2;
                  break;
                }

                throw LogError.LogNotDefinedError();

              case 2:
                if (Log.isLog(log)) {
                  _context3.next = 4;
                  break;
                }

                throw LogError.NotALogError

                // Get the difference of the logs
                ();

              case 4:
                newItems = Log.difference(log, this

                // If we have ACL, verify that all new entries can be joined
                // with this log, throws an error if fails
                );

                if (!this._acl) {
                  _context3.next = 9;
                  break;
                }

                verify = function () {
                  var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(entry) {
                    return _regenerator2.default.wrap(function _callee2$(_context2) {
                      while (1) {
                        switch (_context2.prev = _context2.next) {
                          case 0:
                            _context2.next = 2;
                            return Entry.verify(entry, _this3._acl);

                          case 2:
                            return _context2.abrupt('return', _context2.sent);

                          case 3:
                          case 'end':
                            return _context2.stop();
                        }
                      }
                    }, _callee2, _this3);
                  }));

                  return function verify(_x5) {
                    return _ref3.apply(this, arguments);
                  };
                }();

                _context3.next = 9;
                return pMap((0, _values2.default)(newItems), verify, { concurrency: 1 });

              case 9:

                // Update the internal entry index
                this._entryIndex = (0, _assign2.default)(this._entryIndex, newItems

                // Update the internal next pointers index
                );
                addToNextsIndex = function addToNextsIndex(e) {
                  return e.next.forEach(function (a) {
                    return _this3._nextsIndex[a] = e.hash;
                  });
                };

                (0, _values2.default)(newItems).forEach(addToNextsIndex

                // Update the length
                );this._length += (0, _values2.default)(newItems).length;

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
                return _context3.abrupt('return', this);

              case 22:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
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
     * @param {Function} [verifyEntry]   Custom entry verification function
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
    value: function fromMultihash(ipfs, hash) {
      var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
      var exclude = arguments[3];
      var acl = arguments[4];
      var onProgressCallback = arguments[5];
      var verifyEntry = arguments[6];

      if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError();
      if (!isDefined(hash)) throw new Error('Invalid hash: ' + hash);

      // TODO: need to verify the entries with 'key'
      return LogIO.fromMultihash(ipfs, hash, length, exclude, onProgressCallback).then(function (data) {
        return new Log(ipfs, data.id, data.values, data.heads, data.clock, acl, verifyEntry);
      });
    }

    /**
     * Create a log from a single entry's multihash
     * @param {IPFS}   ipfs        An IPFS instance
     * @param {string} hash        Multihash (as a Base58 encoded string) of the Entry from which to create the log from
     * @param {Number} [length=-1] How many entries to include in the log
     * @param {Function(hash, entry, parent, depth)} onProgressCallback
     * @param {Function} [verifyEntry]   Custom entry verification function
     * @return {Promise<Log>}      New Log
     */

  }, {
    key: 'fromEntryHash',
    value: function fromEntryHash(ipfs, hash, id) {
      var length = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : -1;
      var exclude = arguments[4];
      var acl = arguments[5];
      var onProgressCallback = arguments[6];
      var verifyEntry = arguments[7];

      if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError();
      if (!isDefined(hash)) throw new Error("'hash' must be defined");

      // TODO: need to verify the entries with 'key'
      return LogIO.fromEntryHash(ipfs, hash, id, length, exclude, onProgressCallback).then(function (data) {
        return new Log(ipfs, id, data.values, null, null, acl, verifyEntry);
      });
    }

    /**
     * Create a log from a Log Snapshot JSON
     * @param {IPFS} ipfs          An IPFS instance
     * @param {Object} json        Log snapshot as JSON object
     * @param {Number} [length=-1] How many entries to include in the log
     * @param {Function(hash, entry, parent, depth)} [onProgressCallback]
     * @param {Function} [verifyEntry]   Custom entry verification function
     * @return {Promise<Log>}      New Log
     */

  }, {
    key: 'fromJSON',
    value: function fromJSON(ipfs, json) {
      var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
      var acl = arguments[3];
      var timeout = arguments[4];
      var onProgressCallback = arguments[5];
      var verifyEntry = arguments[6];

      if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError

      // TODO: need to verify the entries with 'key'
      ();return LogIO.fromJSON(ipfs, json, length, key, timeout, onProgressCallback).then(function (data) {
        return new Log(ipfs, data.id, data.values, null, null, acl, verifyEntry);
      });
    }

    /**
     * Create a new log from an Entry instance
     * @param {IPFS}                ipfs          An IPFS instance
     * @param {Entry|Array<Entry>}  sourceEntries An Entry or an array of entries to fetch a log from
     * @param {Number}              [length=-1]   How many entries to include. Default: infinite.
     * @param {Array<Entry|string>} [exclude]     Array of entries or hashes or entries to not fetch (foe eg. cached entries)
     * @param {Function(hash, entry, parent, depth)} [onProgressCallback]
     * @param {Function} [verifyEntry]   Custom entry verification function
     * @return {Promise<Log>}       New Log
     */

  }, {
    key: 'fromEntry',
    value: function fromEntry(ipfs, sourceEntries) {
      var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
      var exclude = arguments[3];
      var onProgressCallback = arguments[4];
      var verifyEntry = arguments[5];

      if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError();
      if (!isDefined(sourceEntries)) throw new Error("'sourceEntries' must be defined");

      // TODO: need to verify the entries with 'key'
      return LogIO.fromEntry(ipfs, sourceEntries, length, exclude, onProgressCallback).then(function (data) {
        return new Log(ipfs, data.id, data.values, null, null, null, verifyEntry);
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
        e.next.forEach(addToReverseIndex
        // Get all next references
        );nexts = nexts.concat(e.next
        // Get the hashes of input entries
        );hashes[e.hash] = true;
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
      .filter(exists // Remove undefineds and nulls
      ).map(findFromReverseIndex // Get the Entry from the reverse index
      ).reduce(addUniques, [] // Flatten the result and take only uniques
      ).concat(nullIndex // Combine with tails the have no next refs (ie. first-in-their-chain)

      );return _uniques(tails, 'hash').sort(Entry.compare);
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