'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _inherits2 = _interopRequireDefault(require("@babel/runtime/helpers/inherits"));

var _possibleConstructorReturn2 = _interopRequireDefault(require("@babel/runtime/helpers/possibleConstructorReturn"));

var _getPrototypeOf2 = _interopRequireDefault(require("@babel/runtime/helpers/getPrototypeOf"));

var _awaitAsyncGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/awaitAsyncGenerator"));

var _wrapAsyncGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/wrapAsyncGenerator"));

function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _createSuper(Derived) { var hasNativeReflectConstruct = _isNativeReflectConstruct(); return function _createSuperInternal() { var Super = (0, _getPrototypeOf2["default"])(Derived), result; if (hasNativeReflectConstruct) { var NewTarget = (0, _getPrototypeOf2["default"])(this).constructor; result = Reflect.construct(Super, arguments, NewTarget); } else { result = Super.apply(this, arguments); } return (0, _possibleConstructorReturn2["default"])(this, result); }; }

function _isNativeReflectConstruct() { if (typeof Reflect === "undefined" || !Reflect.construct) return false; if (Reflect.construct.sham) return false; if (typeof Proxy === "function") return true; try { Date.prototype.toString.call(Reflect.construct(Date, [], function () {})); return true; } catch (e) { return false; } }

var pMap = require('p-map');

var GSet = require('./g-set');

var Entry = require('./entry');

var LogIO = require('./log-io');

var LogError = require('./log-errors');

var Clock = require('./lamport-clock');

var Sorting = require('./log-sorting');

var LastWriteWins = Sorting.LastWriteWins,
    NoZeroes = Sorting.NoZeroes;

var AccessController = require('./default-access-controller');

var _require = require('./utils'),
    isDefined = _require.isDefined,
    findUniques = _require.findUniques;

var EntryIndex = require('./entry-index');

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
 * @description
 * Log implements a G-Set CRDT and adds ordering.
 *
 * From:
 * "A comprehensive study of Convergent and Commutative Replicated Data Types"
 * https://hal.inria.fr/inria-00555588
 */


var Log = /*#__PURE__*/function (_GSet) {
  (0, _inherits2["default"])(Log, _GSet);

  var _super = _createSuper(Log);

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
   * @param {Map} options.hashIndex A Map of entry hashes to next pointers
   * @return {Log} The log instance
   */
  function Log(ipfs, identity) {
    var _this;

    var _ref3 = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
        logId = _ref3.logId,
        access = _ref3.access,
        entries = _ref3.entries,
        heads = _ref3.heads,
        clock = _ref3.clock,
        sortFn = _ref3.sortFn,
        concurrency = _ref3.concurrency,
        _ref3$hashIndex = _ref3.hashIndex,
        hashIndex = _ref3$hashIndex === void 0 ? new Map() : _ref3$hashIndex;

    (0, _classCallCheck2["default"])(this, Log);

    if (!isDefined(ipfs)) {
      throw LogError.IPFSNotDefinedError();
    }

    if (!isDefined(identity)) {
      throw new Error('Identity is required');
    }

    if (!isDefined(access)) {
      access = new AccessController();
    }

    if (isDefined(entries) && !Array.isArray(entries)) {
      throw new Error('\'entries\' argument must be an array of Entry instances');
    }

    if (isDefined(heads) && !Array.isArray(heads)) {
      throw new Error('\'heads\' argument must be an array');
    }

    if (!isDefined(sortFn)) {
      sortFn = LastWriteWins;
    }

    _this = _super.call(this);
    _this._sortFn = NoZeroes(sortFn);
    _this._storage = ipfs;
    _this._id = logId || randomId(); // Access Controller

    _this._access = access; // Identity

    _this._identity = identity; // Add entries to the internal cache

    var uniqueEntries = (entries || []).reduce(uniqueEntriesReducer, {});
    _this._entryIndex = new EntryIndex(uniqueEntries);
    entries = Object.values(uniqueEntries) || []; // Set heads if not passed as an argument

    heads = heads || Log.findHeads(entries);
    _this._headsIndex = heads.reduce(uniqueEntriesReducer, {}); // Index of log hashes

    _this._hashIndex = hashIndex;
    entries.forEach(function (e) {
      return _this._hashIndex.set(e.hash, e.next);
    }); // Index of all next pointers in this log

    _this._nextsIndex = {};

    var addToNextsIndex = function addToNextsIndex(e) {
      return e.next.forEach(function (a) {
        return _this._nextsIndex[a] = e.hash;
      });
    };

    entries.forEach(addToNextsIndex);
    hashIndex.forEach(function (nexts, hash) {
      return nexts.forEach(function (a) {
        return _this._nextsIndex[a] = hash;
      });
    }); // Set the clock

    var maxTime = Math.max(clock ? clock.time : 0, _this.heads.reduce(maxClockTimeReducer, 0)); // Take the given key as the clock id is it's a Key instance,
    // otherwise if key was given, take whatever it is,
    // and if it was null, take the given id as the clock id

    _this._clock = new Clock(_this._identity.publicKey, maxTime);
    _this.joinConcurrency = concurrency || 16;
    return _this;
  }
  /**
   * Returns the ID of the log.
   * @returns {string}
   */


  (0, _createClass2["default"])(Log, [{
    key: "values",

    /**
     * Returns the values in the log.
     * @returns {Promise<Array<Entry>>}
     */
    value: function () {
      var _values = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee() {
        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.t0 = Object;
                _context.next = 3;
                return this.traverse(this.heads);

              case 3:
                _context.t1 = _context.sent;
                return _context.abrupt("return", _context.t0.values.call(_context.t0, _context.t1).reverse());

              case 5:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function values() {
        return _values.apply(this, arguments);
      }

      return values;
    }()
    /**
     * Returns an array of heads as hashes.
     * @returns {Array<string>}
     */

  }, {
    key: "tails",

    /**
     * Returns an array of Entry objects that reference entries which
     * are not in the log currently.
     * @returns {Promise<Array<Entry>>}
     */
    value: function () {
      var _tails = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2() {
        var values;
        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this.values();

              case 2:
                values = _context2.sent;
                return _context2.abrupt("return", Log.findTails(values));

              case 4:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function tails() {
        return _tails.apply(this, arguments);
      }

      return tails;
    }()
    /**
     * Returns an array of hashes that are referenced by entries which
     * are not in the log currently.
     * @returns {Promise<Array<string>>} Array of hashes
     */

  }, {
    key: "tailHashes",
    value: function () {
      var _tailHashes = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3() {
        var values;
        return _regenerator["default"].wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.values();

              case 2:
                values = _context3.sent;
                return _context3.abrupt("return", Log.findTailHashes(values));

              case 4:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function tailHashes() {
        return _tailHashes.apply(this, arguments);
      }

      return tailHashes;
    }()
    /**
     * Set the identity for the log
     * @param {Identity} [identity] The identity to be set
     */

  }, {
    key: "setIdentity",
    value: function setIdentity(identity) {
      this._identity = identity; // Find the latest clock from the heads

      var time = Math.max(this.clock.time, this.heads.reduce(maxClockTimeReducer, 0));
      this._clock = new Clock(this._identity.publicKey, time);
    }
    /**
     * Find an entry.
     * @param {string} [hash] The hashes of the entry
     * @returns {Promise<Entry|undefined>}
     */

  }, {
    key: "get",
    value: function () {
      var _get = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(hash) {
        var haveCache, entry;
        return _regenerator["default"].wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (this.has(hash)) {
                  _context4.next = 2;
                  break;
                }

                return _context4.abrupt("return", undefined);

              case 2:
                haveCache = this._entryIndex.get(hash);

                if (!haveCache) {
                  _context4.next = 5;
                  break;
                }

                return _context4.abrupt("return", haveCache);

              case 5:
                _context4.prev = 5;
                _context4.next = 8;
                return Entry.fromMultihash(this._storage, hash);

              case 8:
                entry = _context4.sent;

                this._entryIndex.set(entry.hash, entry);

                _context4.next = 14;
                break;

              case 12:
                _context4.prev = 12;
                _context4.t0 = _context4["catch"](5);

              case 14:
                return _context4.abrupt("return", entry);

              case 15:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this, [[5, 12]]);
      }));

      function get(_x) {
        return _get.apply(this, arguments);
      }

      return get;
    }()
    /**
     * Checks if a entry is part of the log
     * @param {string} hash The hash of the entry
     * @returns {boolean}
     */

  }, {
    key: "has",
    value: function has(entry) {
      return this._hashIndex.has(entry.hash || entry);
    }
  }, {
    key: "traverse",
    value: function () {
      var _traverse = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee6(rootEntries) {
        var _this2 = this;

        var amount,
            endHash,
            stack,
            traversed,
            result,
            count,
            getEntry,
            addToStack,
            addEntry,
            entry,
            entries,
            defined,
            _args6 = arguments;
        return _regenerator["default"].wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                amount = _args6.length > 1 && _args6[1] !== undefined ? _args6[1] : -1;
                endHash = _args6.length > 2 ? _args6[2] : undefined;
                // Sort the given given root entries and use as the starting stack
                stack = rootEntries.sort(this._sortFn).reverse(); // Cache for checking if we've processed an entry already

                traversed = {}; // End result

                result = {};
                count = 0; // Named function for getting an entry from the log

                getEntry = /*#__PURE__*/function () {
                  var _ref4 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee5(e) {
                    return _regenerator["default"].wrap(function _callee5$(_context5) {
                      while (1) {
                        switch (_context5.prev = _context5.next) {
                          case 0:
                            return _context5.abrupt("return", _this2.get(e));

                          case 1:
                          case "end":
                            return _context5.stop();
                        }
                      }
                    }, _callee5);
                  }));

                  return function getEntry(_x3) {
                    return _ref4.apply(this, arguments);
                  };
                }(); // Add an entry to the stack and traversed nodes index


                addToStack = function addToStack(entry) {
                  // If we've already processed the entry, don't add it to the stack
                  if (!entry || traversed[entry.hash]) {
                    return;
                  } // Add the entry in front of the stack and sort


                  stack = [entry].concat((0, _toConsumableArray2["default"])(stack)).sort(_this2._sortFn).reverse(); // Add to the cache of processed entries

                  traversed[entry.hash] = true;
                };

                addEntry = function addEntry(rootEntry) {
                  result[rootEntry.hash] = rootEntry;
                  traversed[rootEntry.hash] = true;
                  count++;
                }; // Start traversal
                // Process stack until it's empty (traversed the full log)
                // or when we have the requested amount of entries
                // If requested entry amount is -1, traverse all


              case 9:
                if (!(stack.length > 0 && (count < amount || amount < 0))) {
                  _context6.next = 21;
                  break;
                }

                // eslint-disable-line no-unmodified-loop-condition
                // Get the next element from the stack
                entry = stack.shift(); // Add to the result

                addEntry(entry); // If it is the specified end hash, break out of the while loop

                if (!(endHash && endHash === entry.hash)) {
                  _context6.next = 14;
                  break;
                }

                return _context6.abrupt("break", 21);

              case 14:
                _context6.next = 16;
                return pMap(entry.next, getEntry);

              case 16:
                entries = _context6.sent;
                defined = entries.filter(isDefined);
                defined.forEach(addToStack);
                _context6.next = 9;
                break;

              case 21:
                stack = [];
                traversed = {}; // End result

                return _context6.abrupt("return", result);

              case 24:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function traverse(_x2) {
        return _traverse.apply(this, arguments);
      }

      return traverse;
    }()
    /**
     * Append an entry to the log.
     * @param {Entry} entry Entry to add
     * @return {Promise<Log>} New Log containing the appended value
     */

  }, {
    key: "append",
    value: function () {
      var _append = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee7(data) {
        var _this3 = this;

        var pointerCount,
            pin,
            newTime,
            all,
            getEveryPow2,
            references,
            nexts,
            isNext,
            refs,
            entry,
            canAppend,
            _args7 = arguments;
        return _regenerator["default"].wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                pointerCount = _args7.length > 1 && _args7[1] !== undefined ? _args7[1] : 1;
                pin = _args7.length > 2 && _args7[2] !== undefined ? _args7[2] : false;
                // Update the clock (find the latest clock)
                newTime = Math.max(this.clock.time, this.heads.reduce(maxClockTimeReducer, 0)) + 1;
                this._clock = new Clock(this.clock.id, newTime);
                _context7.t0 = Object;
                _context7.next = 7;
                return this.traverse(this.heads, Math.max(pointerCount, this.heads.length));

              case 7:
                _context7.t1 = _context7.sent;
                all = _context7.t0.values.call(_context7.t0, _context7.t1);

                // If pointer count is 4, returns 2
                // If pointer count is 8, returns 3 references
                // If pointer count is 512, returns 9 references
                // If pointer count is 2048, returns 11 references
                getEveryPow2 = function getEveryPow2(maxDistance) {
                  var entries = new Set();

                  for (var i = 1; i <= maxDistance; i *= 2) {
                    var index = Math.min(i - 1, all.length - 1);
                    entries.add(all[index]);
                  }

                  return entries;
                };

                references = getEveryPow2(Math.min(pointerCount, all.length)); // Always include the last known reference

                if (all.length < pointerCount && all[all.length - 1]) {
                  references.add(all[all.length - 1]);
                } // Create the next pointers from heads


                nexts = Object.keys(this.heads.reverse().reduce(uniqueEntriesReducer, {}));

                isNext = function isNext(e) {
                  return !nexts.includes(e);
                }; // Delete the heads from the refs


                refs = Array.from(references).map(getHash).filter(isNext); // @TODO: Split Entry.create into creating object, checking permission, signing and then posting to IPFS
                // Create the entry and add it to the internal cache

                _context7.next = 17;
                return Entry.create(this._storage, this._identity, this.id, data, nexts, this.clock, refs, pin);

              case 17:
                entry = _context7.sent;
                _context7.next = 20;
                return this._access.canAppend(entry, this._identity.provider);

              case 20:
                canAppend = _context7.sent;

                if (canAppend) {
                  _context7.next = 23;
                  break;
                }

                throw new Error("Could not append entry, key \"".concat(this._identity.id, "\" is not allowed to write to the log"));

              case 23:
                this._entryIndex.set(entry.hash, entry);

                nexts.forEach(function (e) {
                  return _this3._nextsIndex[e] = entry.hash;
                });
                this._headsIndex = {};
                this._headsIndex[entry.hash] = entry;

                this._hashIndex.set(entry.hash, nexts);

                return _context7.abrupt("return", entry);

              case 29:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function append(_x4) {
        return _append.apply(this, arguments);
      }

      return append;
    }()
    /*
     * Creates a javscript iterator over log entries
     *
     * @param {Object} options
     * @param {string|Array} options.gt Beginning hash of the iterator, non-inclusive
     * @param {string|Array} options.gte Beginning hash of the iterator, inclusive
     * @param {string|Array} options.lt Ending hash of the iterator, non-inclusive
     * @param {string|Array} options.lte Ending hash of the iterator, inclusive
     * @param {amount} options.amount Number of entried to return to / from the gte / lte hash
     * @returns {Symbol.asyncIterator} asyncIterator object containing log entries
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

  }, {
    key: "iterator",
    value: function iterator() {
      var _ref5 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref5$gt = _ref5.gt,
          gt = _ref5$gt === void 0 ? undefined : _ref5$gt,
          _ref5$gte = _ref5.gte,
          gte = _ref5$gte === void 0 ? undefined : _ref5$gte,
          _ref5$lt = _ref5.lt,
          lt = _ref5$lt === void 0 ? undefined : _ref5$lt,
          _ref5$lte = _ref5.lte,
          lte = _ref5$lte === void 0 ? undefined : _ref5$lte,
          _ref5$amount = _ref5.amount,
          amount = _ref5$amount === void 0 ? -1 : _ref5$amount;

      if (amount === 0) return (0, _wrapAsyncGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee8() {
        return _regenerator["default"].wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8);
      }))();
      if (typeof lte === 'string') lte = [this.get(lte)];
      if (typeof lt === 'string') lt = [this.get(this.get(lt).next[0])];
      if (lte && !Array.isArray(lte)) throw LogError.LtOrLteMustBeStringOrArray();
      if (lt && !Array.isArray(lt)) throw LogError.LtOrLteMustBeStringOrArray();
      var self = this;
      return (0, _wrapAsyncGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee9() {
        var value, _value, next, start, endHash, _value2, _value3, count, entries, entryValues, _iterator, _step, _value4;

        return _regenerator["default"].wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                if (!(typeof lte === 'string')) {
                  _context9.next = 5;
                  break;
                }

                _context9.next = 3;
                return (0, _awaitAsyncGenerator2["default"])(self.get(lte));

              case 3:
                value = _context9.sent;
                lte = [value];

              case 5:
                if (!(typeof lt === 'string')) {
                  _context9.next = 13;
                  break;
                }

                _context9.next = 8;
                return (0, _awaitAsyncGenerator2["default"])(self.get(lt));

              case 8:
                _value = _context9.sent;
                _context9.next = 11;
                return (0, _awaitAsyncGenerator2["default"])(self.get(_value.next[0]));

              case 11:
                next = _context9.sent;
                lt = [next];

              case 13:
                start = (lte || lt || self.heads).filter(isDefined);
                endHash = null;

                if (!gte) {
                  _context9.next = 22;
                  break;
                }

                _context9.next = 18;
                return (0, _awaitAsyncGenerator2["default"])(self.get(gte));

              case 18:
                _value2 = _context9.sent;
                endHash = _value2.hash;
                _context9.next = 27;
                break;

              case 22:
                if (!gt) {
                  _context9.next = 27;
                  break;
                }

                _context9.next = 25;
                return (0, _awaitAsyncGenerator2["default"])(self.get(gt));

              case 25:
                _value3 = _context9.sent;
                endHash = _value3.hash;

              case 27:
                count = endHash ? -1 : amount || -1;
                _context9.next = 30;
                return (0, _awaitAsyncGenerator2["default"])(self.traverse(start, count, endHash));

              case 30:
                entries = _context9.sent;
                entryValues = Object.values(entries); // Strip off last entry if gt is non-inclusive

                if (gt) entryValues.pop(); // Deal with the amount argument working backwards from gt/gte

                if ((gt || gte) && amount > -1) {
                  entryValues = entryValues.slice(entryValues.length - amount, entryValues.length);
                }

                _iterator = _createForOfIteratorHelper(entryValues);
                _context9.prev = 35;

                _iterator.s();

              case 37:
                if ((_step = _iterator.n()).done) {
                  _context9.next = 43;
                  break;
                }

                _value4 = _step.value;
                _context9.next = 41;
                return _value4;

              case 41:
                _context9.next = 37;
                break;

              case 43:
                _context9.next = 48;
                break;

              case 45:
                _context9.prev = 45;
                _context9.t0 = _context9["catch"](35);

                _iterator.e(_context9.t0);

              case 48:
                _context9.prev = 48;

                _iterator.f();

                return _context9.finish(48);

              case 51:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, null, [[35, 45, 48, 51]]);
      }))();
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

  }, {
    key: "join",
    value: function () {
      var _join = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee13(log) {
        var _this4 = this;

        var size,
            newItems,
            identityProvider,
            permitted,
            verify,
            entriesToJoin,
            addToIndexes,
            notReferencedByNewItems,
            notInCurrentNexts,
            nextsFromNewItems,
            mergedHeads,
            tmp,
            addToNextsIndex,
            maxClock,
            _args13 = arguments;
        return _regenerator["default"].wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                size = _args13.length > 1 && _args13[1] !== undefined ? _args13[1] : -1;

                if (isDefined(log)) {
                  _context13.next = 3;
                  break;
                }

                throw LogError.LogNotDefinedError();

              case 3:
                if (Log.isLog(log)) {
                  _context13.next = 5;
                  break;
                }

                throw LogError.NotALogError();

              case 5:
                if (!(this.id !== log.id)) {
                  _context13.next = 7;
                  break;
                }

                return _context13.abrupt("return");

              case 7:
                _context13.next = 9;
                return Log.difference(log, this);

              case 9:
                newItems = _context13.sent;
                identityProvider = this._identity.provider; // Verify if entries are allowed to be added to the log and throws if
                // there's an invalid entry

                permitted = /*#__PURE__*/function () {
                  var _ref6 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee10(entry) {
                    var canAppend;
                    return _regenerator["default"].wrap(function _callee10$(_context10) {
                      while (1) {
                        switch (_context10.prev = _context10.next) {
                          case 0:
                            _context10.next = 2;
                            return _this4._access.canAppend(entry, identityProvider);

                          case 2:
                            canAppend = _context10.sent;

                            if (canAppend) {
                              _context10.next = 5;
                              break;
                            }

                            throw new Error("Could not append entry, key \"".concat(entry.identity.id, "\" is not allowed to write to the log"));

                          case 5:
                          case "end":
                            return _context10.stop();
                        }
                      }
                    }, _callee10);
                  }));

                  return function permitted(_x6) {
                    return _ref6.apply(this, arguments);
                  };
                }(); // Verify signature for each entry and throws if there's an invalid signature


                verify = /*#__PURE__*/function () {
                  var _ref7 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee11(entry) {
                    var isValid, publicKey;
                    return _regenerator["default"].wrap(function _callee11$(_context11) {
                      while (1) {
                        switch (_context11.prev = _context11.next) {
                          case 0:
                            _context11.next = 2;
                            return Entry.verify(identityProvider, entry);

                          case 2:
                            isValid = _context11.sent;
                            publicKey = entry.identity ? entry.identity.publicKey : entry.key;

                            if (isValid) {
                              _context11.next = 6;
                              break;
                            }

                            throw new Error("Could not validate signature \"".concat(entry.sig, "\" for entry \"").concat(entry.hash, "\" and key \"").concat(publicKey, "\""));

                          case 6:
                          case "end":
                            return _context11.stop();
                        }
                      }
                    }, _callee11);
                  }));

                  return function verify(_x7) {
                    return _ref7.apply(this, arguments);
                  };
                }();

                entriesToJoin = Object.values(newItems);
                _context13.next = 16;
                return pMap(entriesToJoin, /*#__PURE__*/function () {
                  var _ref8 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee12(e) {
                    return _regenerator["default"].wrap(function _callee12$(_context12) {
                      while (1) {
                        switch (_context12.prev = _context12.next) {
                          case 0:
                            _context12.next = 2;
                            return permitted(e);

                          case 2:
                            _context12.next = 4;
                            return verify(e);

                          case 4:
                          case "end":
                            return _context12.stop();
                        }
                      }
                    }, _callee12);
                  }));

                  return function (_x8) {
                    return _ref8.apply(this, arguments);
                  };
                }(), {
                  concurrency: this.joinConcurrency
                });

              case 16:
                // Update internal indexes
                addToIndexes = function addToIndexes(e) {
                  e.next.forEach(function (a) {
                    return _this4._nextsIndex[a] = e.hash;
                  });

                  _this4._hashIndex.set(e.hash, e.next);
                };

                entriesToJoin.forEach(addToIndexes); // Update the internal entry index

                this._entryIndex.add(newItems); // Merge the heads


                notReferencedByNewItems = function notReferencedByNewItems(e) {
                  return !nextsFromNewItems.find(function (a) {
                    return a === e.hash;
                  });
                };

                notInCurrentNexts = function notInCurrentNexts(e) {
                  return !_this4._nextsIndex[e.hash];
                };

                nextsFromNewItems = Object.values(newItems).map(getNextPointers).reduce(flatMap, []);
                mergedHeads = Log.findHeads(Object.values(Object.assign({}, this._headsIndex, log._headsIndex))).filter(notReferencedByNewItems).filter(notInCurrentNexts).reduce(uniqueEntriesReducer, {});
                this._headsIndex = mergedHeads; // Slice to the requested size

                if (!(size > -1)) {
                  _context13.next = 37;
                  break;
                }

                _context13.next = 27;
                return this.values();

              case 27:
                tmp = _context13.sent;
                tmp = tmp.slice(-size);
                this._entryIndex = null;
                this._entryIndex = new EntryIndex(tmp.reduce(uniqueEntriesReducer, {}));
                this._hashIndex = new Map();
                tmp.forEach(function (e) {
                  return _this4._hashIndex.set(e.hash, e.next);
                });
                this._nextsIndex = {};

                addToNextsIndex = function addToNextsIndex(e) {
                  return e.next.forEach(function (a) {
                    return _this4._nextsIndex[a] = e.hash;
                  });
                };

                tmp.forEach(addToNextsIndex);
                this._headsIndex = Log.findHeads(tmp).reduce(uniqueEntriesReducer, {});

              case 37:
                // Find the latest clock from the heads
                maxClock = Object.values(this._headsIndex).reduce(maxClockTimeReducer, 0);
                this._clock = new Clock(this.clock.id, Math.max(this.clock.time, maxClock));
                return _context13.abrupt("return", this);

              case 40:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13, this);
      }));

      function join(_x5) {
        return _join.apply(this, arguments);
      }

      return join;
    }()
    /**
     * Get the log in JSON format.
     * @returns {Object} An object with the id and heads properties
     */

  }, {
    key: "toJSON",
    value: function toJSON() {
      return {
        id: this.id,
        heads: this.heads.sort(this._sortFn) // default sorting
        .reverse() // we want the latest as the first element
        .map(getHash) // return only the head hashes

      };
    }
    /**
     * Get the log in JSON format as a snapshot.
     * @returns {Object} An object with the id, heads and value properties
     */

  }, {
    key: "toSnapshot",
    value: function () {
      var _toSnapshot = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee14() {
        var values;
        return _regenerator["default"].wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                _context14.next = 2;
                return this.values();

              case 2:
                values = _context14.sent;
                return _context14.abrupt("return", {
                  id: this.id,
                  heads: this.heads,
                  values: values
                });

              case 4:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14, this);
      }));

      function toSnapshot() {
        return _toSnapshot.apply(this, arguments);
      }

      return toSnapshot;
    }()
    /**
     * Get the log as a Buffer.
     * @returns {Buffer}
     */

  }, {
    key: "toBuffer",
    value: function toBuffer() {
      return Buffer.from(JSON.stringify(this.toJSON()));
    }
    /**
     * Returns the log entries as a formatted string.
     * @returns {string}
     * @example
     * two
     * └─one
     *   └─three
     */

  }, {
    key: "toString",
    value: function () {
      var _toString = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee15(payloadMapper) {
        var values;
        return _regenerator["default"].wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                _context15.next = 2;
                return this.values();

              case 2:
                values = _context15.sent;
                return _context15.abrupt("return", values.slice().reverse().map(function (e, idx) {
                  var parents = Entry.findChildren(e, values);
                  var len = parents.length;
                  var padding = new Array(Math.max(len - 1, 0));
                  padding = len > 1 ? padding.fill('  ') : padding;
                  padding = len > 0 ? padding.concat(['└─']) : padding;
                  /* istanbul ignore next */

                  return padding.join('') + (payloadMapper ? payloadMapper(e.payload) : e.payload);
                }).join('\n'));

              case 4:
              case "end":
                return _context15.stop();
            }
          }
        }, _callee15, this);
      }));

      function toString(_x9) {
        return _toString.apply(this, arguments);
      }

      return toString;
    }()
    /**
     * Check whether an object is a Log instance.
     * @param {Object} log An object to check
     * @returns {boolean}
     */

  }, {
    key: "toMultihash",

    /**
     * Get the log's multihash.
     * @returns {Promise<string>} Multihash of the Log as Base58 encoded string.
     */
    value: function toMultihash() {
      var _ref9 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          format = _ref9.format;

      return LogIO.toMultihash(this._storage, this, {
        format: format
      });
    }
    /**
     * Create a log from a hashes.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Identity} identity The identity instance
     * @param {string} hash The log hash
     * @param {Object} options
     * @param {AccessController} options.access The access controller instance
     * @param {number} options.length How many items to include in the log
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(hash, entry, parent, depth)} options.onProgressCallback
     * @param {Function} options.sortFn The sort function - by default LastWriteWins
     * @returns {Promise<Log>}
     */

  }, {
    key: "id",
    get: function get() {
      return this._id;
    }
    /**
     * Returns the clock of the log.
     * @returns {string}
     */

  }, {
    key: "clock",
    get: function get() {
      return this._clock;
    }
    /**
     * Returns the length of the log.
     * @return {number} Length
     */

  }, {
    key: "length",
    get: function get() {
      return this._hashIndex.size;
    }
  }, {
    key: "heads",
    get: function get() {
      return Object.values(this._headsIndex).sort(this._sortFn).reverse();
    }
  }], [{
    key: "isLog",
    value: function isLog(log) {
      return log.id !== undefined && log.heads !== undefined;
    }
  }, {
    key: "fromMultihash",
    value: function () {
      var _fromMultihash = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee16(ipfs, identity, hash) {
        var _ref10,
            access,
            _ref10$length,
            length,
            _ref10$exclude,
            exclude,
            timeout,
            concurrency,
            sortFn,
            onProgressCallback,
            _yield$LogIO$fromMult,
            logId,
            entries,
            heads,
            _args16 = arguments;

        return _regenerator["default"].wrap(function _callee16$(_context16) {
          while (1) {
            switch (_context16.prev = _context16.next) {
              case 0:
                _ref10 = _args16.length > 3 && _args16[3] !== undefined ? _args16[3] : {}, access = _ref10.access, _ref10$length = _ref10.length, length = _ref10$length === void 0 ? -1 : _ref10$length, _ref10$exclude = _ref10.exclude, exclude = _ref10$exclude === void 0 ? [] : _ref10$exclude, timeout = _ref10.timeout, concurrency = _ref10.concurrency, sortFn = _ref10.sortFn, onProgressCallback = _ref10.onProgressCallback;
                _context16.next = 3;
                return LogIO.fromMultihash(ipfs, hash, {
                  length: length,
                  exclude: exclude,
                  timeout: timeout,
                  onProgressCallback: onProgressCallback,
                  concurrency: concurrency,
                  sortFn: sortFn
                });

              case 3:
                _yield$LogIO$fromMult = _context16.sent;
                logId = _yield$LogIO$fromMult.logId;
                entries = _yield$LogIO$fromMult.entries;
                heads = _yield$LogIO$fromMult.heads;
                return _context16.abrupt("return", new Log(ipfs, identity, {
                  logId: logId,
                  access: access,
                  entries: entries,
                  heads: heads,
                  sortFn: sortFn
                }));

              case 8:
              case "end":
                return _context16.stop();
            }
          }
        }, _callee16);
      }));

      function fromMultihash(_x10, _x11, _x12) {
        return _fromMultihash.apply(this, arguments);
      }

      return fromMultihash;
    }()
    /**
     * Create a log from a single entry's hash.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Identity} identity The identity instance
     * @param {string} hash The entry's hash
     * @param {Object} options
     * @param {string} options.logId The ID of the log
     * @param {AccessController} options.access The access controller instance
     * @param {number} options.length How many entries to include in the log
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(hash, entry, parent, depth)} options.onProgressCallback
     * @param {Function} options.sortFn The sort function - by default LastWriteWins
     * @return {Promise<Log>} New Log
     */

  }, {
    key: "fromEntryHash",
    value: function () {
      var _fromEntryHash = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee17(ipfs, identity, hash) {
        var _ref11,
            logId,
            access,
            _ref11$length,
            length,
            _ref11$exclude,
            exclude,
            timeout,
            concurrency,
            sortFn,
            onProgressCallback,
            _yield$LogIO$fromEntr,
            entries,
            _args17 = arguments;

        return _regenerator["default"].wrap(function _callee17$(_context17) {
          while (1) {
            switch (_context17.prev = _context17.next) {
              case 0:
                _ref11 = _args17.length > 3 && _args17[3] !== undefined ? _args17[3] : {}, logId = _ref11.logId, access = _ref11.access, _ref11$length = _ref11.length, length = _ref11$length === void 0 ? -1 : _ref11$length, _ref11$exclude = _ref11.exclude, exclude = _ref11$exclude === void 0 ? [] : _ref11$exclude, timeout = _ref11.timeout, concurrency = _ref11.concurrency, sortFn = _ref11.sortFn, onProgressCallback = _ref11.onProgressCallback;
                _context17.next = 3;
                return LogIO.fromEntryHash(ipfs, hash, {
                  length: length,
                  exclude: exclude,
                  timeout: timeout,
                  concurrency: concurrency,
                  onProgressCallback: onProgressCallback
                });

              case 3:
                _yield$LogIO$fromEntr = _context17.sent;
                entries = _yield$LogIO$fromEntr.entries;
                return _context17.abrupt("return", new Log(ipfs, identity, {
                  logId: logId,
                  access: access,
                  entries: entries,
                  sortFn: sortFn
                }));

              case 6:
              case "end":
                return _context17.stop();
            }
          }
        }, _callee17);
      }));

      function fromEntryHash(_x13, _x14, _x15) {
        return _fromEntryHash.apply(this, arguments);
      }

      return fromEntryHash;
    }()
    /**
     * Create a log from a Log Snapshot JSON.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Identity} identity The identity instance
     * @param {Object} json Log snapshot as JSON object
     * @param {Object} options
     * @param {AccessController} options.access The access controller instance
     * @param {number} options.length How many entries to include in the log
     * @param {function(hash, entry, parent, depth)} [options.onProgressCallback]
     * @param {Function} options.sortFn The sort function - by default LastWriteWins
     * @return {Promise<Log>} New Log
     */

  }, {
    key: "fromJSON",
    value: function () {
      var _fromJSON = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee18(ipfs, identity, json) {
        var _ref12,
            access,
            _ref12$length,
            length,
            timeout,
            sortFn,
            onProgressCallback,
            _yield$LogIO$fromJSON,
            logId,
            entries,
            _args18 = arguments;

        return _regenerator["default"].wrap(function _callee18$(_context18) {
          while (1) {
            switch (_context18.prev = _context18.next) {
              case 0:
                _ref12 = _args18.length > 3 && _args18[3] !== undefined ? _args18[3] : {}, access = _ref12.access, _ref12$length = _ref12.length, length = _ref12$length === void 0 ? -1 : _ref12$length, timeout = _ref12.timeout, sortFn = _ref12.sortFn, onProgressCallback = _ref12.onProgressCallback;
                _context18.next = 3;
                return LogIO.fromJSON(ipfs, json, {
                  length: length,
                  timeout: timeout,
                  onProgressCallback: onProgressCallback
                });

              case 3:
                _yield$LogIO$fromJSON = _context18.sent;
                logId = _yield$LogIO$fromJSON.logId;
                entries = _yield$LogIO$fromJSON.entries;
                return _context18.abrupt("return", new Log(ipfs, identity, {
                  logId: logId,
                  access: access,
                  entries: entries,
                  sortFn: sortFn
                }));

              case 7:
              case "end":
                return _context18.stop();
            }
          }
        }, _callee18);
      }));

      function fromJSON(_x16, _x17, _x18) {
        return _fromJSON.apply(this, arguments);
      }

      return fromJSON;
    }()
    /**
     * Create a new log from an Entry instance.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Identity} identity The identity instance
     * @param {Entry|Array<Entry>} sourceEntries An Entry or an array of entries to fetch a log from
     * @param {Object} options
     * @param {AccessController} options.access The access controller instance
     * @param {number} options.length How many entries to include. Default: infinite.
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(hash, entry, parent, depth)} [options.onProgressCallback]
     * @param {Function} options.sortFn The sort function - by default LastWriteWins
     * @return {Promise<Log>} New Log
     */

  }, {
    key: "fromEntry",
    value: function () {
      var _fromEntry = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee19(ipfs, identity, sourceEntries) {
        var _ref13,
            access,
            _ref13$length,
            length,
            _ref13$exclude,
            exclude,
            timeout,
            concurrency,
            sortFn,
            onProgressCallback,
            _yield$LogIO$fromEntr2,
            logId,
            entries,
            _args19 = arguments;

        return _regenerator["default"].wrap(function _callee19$(_context19) {
          while (1) {
            switch (_context19.prev = _context19.next) {
              case 0:
                _ref13 = _args19.length > 3 && _args19[3] !== undefined ? _args19[3] : {}, access = _ref13.access, _ref13$length = _ref13.length, length = _ref13$length === void 0 ? -1 : _ref13$length, _ref13$exclude = _ref13.exclude, exclude = _ref13$exclude === void 0 ? [] : _ref13$exclude, timeout = _ref13.timeout, concurrency = _ref13.concurrency, sortFn = _ref13.sortFn, onProgressCallback = _ref13.onProgressCallback;
                _context19.next = 3;
                return LogIO.fromEntry(ipfs, sourceEntries, {
                  length: length,
                  exclude: exclude,
                  timeout: timeout,
                  concurrency: concurrency,
                  onProgressCallback: onProgressCallback
                });

              case 3:
                _yield$LogIO$fromEntr2 = _context19.sent;
                logId = _yield$LogIO$fromEntr2.logId;
                entries = _yield$LogIO$fromEntr2.entries;
                return _context19.abrupt("return", new Log(ipfs, identity, {
                  logId: logId,
                  access: access,
                  entries: entries,
                  sortFn: sortFn
                }));

              case 7:
              case "end":
                return _context19.stop();
            }
          }
        }, _callee19);
      }));

      function fromEntry(_x19, _x20, _x21) {
        return _fromEntry.apply(this, arguments);
      }

      return fromEntry;
    }()
    /**
     * Find heads from a collection of entries.
     *
     * Finds entries that are the heads of this collection,
     * ie. entries that are not referenced by other entries.
     *
     * @param {Array<Entry>} entries Entries to search heads from
     * @returns {Array<Entry>}
     */

  }, {
    key: "findHeads",
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
    } // Find entries that point to another entry that is not in the
    // input array

  }, {
    key: "findTails",
    value: function findTails(entries) {
      // Reverse index { next -> entry }
      var reverseIndex = {}; // Null index containing entries that have no parents (nexts)

      var nullIndex = []; // Hashes for all entries for quick lookups

      var hashes = {}; // Hashes of all next entries

      var nexts = [];

      var addToIndex = function addToIndex(e) {
        if (e.next.length === 0) {
          nullIndex.push(e);
        }

        var addToReverseIndex = function addToReverseIndex(a) {
          /* istanbul ignore else */
          if (!reverseIndex[a]) reverseIndex[a] = [];
          reverseIndex[a].push(e);
        }; // Add all entries and their parents to the reverse index


        e.next.forEach(addToReverseIndex); // Get all next references

        nexts = nexts.concat(e.next); // Get the hashes of input entries

        hashes[e.hash] = true;
      }; // Create our indices


      entries.forEach(addToIndex);

      var addUniques = function addUniques(res, entries, idx, arr) {
        return res.concat(findUniques(entries, 'hash'));
      };

      var exists = function exists(e) {
        return hashes[e] === undefined;
      };

      var findFromReverseIndex = function findFromReverseIndex(e) {
        return reverseIndex[e];
      }; // Drop hashes that are not in the input entries


      var tails = nexts // For every hash in nexts:
      .filter(exists) // Remove undefineds and nulls
      .map(findFromReverseIndex) // Get the Entry from the reverse index
      .reduce(addUniques, []) // Flatten the result and take only uniques
      .concat(nullIndex); // Combine with tails the have no next refs (ie. first-in-their-chain)

      return findUniques(tails, 'hash').sort(Entry.compare);
    } // Find the hashes to entries that are not in a collection
    // but referenced by other entries

  }, {
    key: "findTailHashes",
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
    key: "difference",
    value: function () {
      var _difference = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee20(a, b) {
        var res, hashesFromA, diff, entries;
        return _regenerator["default"].wrap(function _callee20$(_context20) {
          while (1) {
            switch (_context20.prev = _context20.next) {
              case 0:
                res = {};
                hashesFromA = Array.from(a._hashIndex.keys());
                diff = hashesFromA.filter(function (hash) {
                  return !b.has(hash);
                });
                _context20.next = 5;
                return pMap(diff, function (hash) {
                  return a.get(hash);
                });

              case 5:
                entries = _context20.sent;
                entries.forEach(function (e) {
                  res[e.hash] = e;
                });
                return _context20.abrupt("return", res);

              case 8:
              case "end":
                return _context20.stop();
            }
          }
        }, _callee20);
      }));

      function difference(_x22, _x23) {
        return _difference.apply(this, arguments);
      }

      return difference;
    }()
  }]);
  return Log;
}(GSet);

Log.Entry = Entry;
module.exports = Log;
module.exports.Sorting = Sorting;
module.exports.Entry = Entry;
module.exports.AccessController = AccessController;