'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var Entry = require('./entry');

var EntryIO = require('./entry-io');

var Clock = require('./lamport-clock');

var LogError = require('./log-errors');

var _require = require('./utils'),
    isDefined = _require.isDefined,
    findUniques = _require.findUniques,
    difference = _require.difference,
    dagNode = _require.dagNode;

var IPLD_LINKS = ['heads'];

var last = function last(arr, n) {
  return arr.slice(arr.length - n, arr.length);
};

var LogIO =
/*#__PURE__*/
function () {
  function LogIO() {
    (0, _classCallCheck2.default)(this, LogIO);
  }

  (0, _createClass2.default)(LogIO, null, [{
    key: "toCID",

    /**
     * Get the CID of a Log.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Log} log Log to get a CID for
     * @returns {Promise<string>}
     */
    value: function () {
      var _toCID = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee(ipfs, log) {
        return _regenerator.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (isDefined(ipfs)) {
                  _context.next = 2;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 2:
                if (isDefined(log)) {
                  _context.next = 4;
                  break;
                }

                throw LogError.LogNotDefinedError();

              case 4:
                if (!(log.values.length < 1)) {
                  _context.next = 6;
                  break;
                }

                throw new Error("Can't serialize an empty log");

              case 6:
                return _context.abrupt("return", dagNode.write(ipfs, 'dag-cbor', log.toJSON(), IPLD_LINKS));

              case 7:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function toCID(_x, _x2) {
        return _toCID.apply(this, arguments);
      }

      return toCID;
    }()
    /**
     * Get the multihash of a Log.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Log} log Log to get a multihash for
     * @returns {Promise<string>}
     * @deprecated
     */

  }, {
    key: "toMultihash",
    value: function () {
      var _toMultihash = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee2(ipfs, log) {
        return _regenerator.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                if (isDefined(ipfs)) {
                  _context2.next = 2;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 2:
                if (isDefined(log)) {
                  _context2.next = 4;
                  break;
                }

                throw LogError.LogNotDefinedError();

              case 4:
                if (!(log.values.length < 1)) {
                  _context2.next = 6;
                  break;
                }

                throw new Error("Can't serialize an empty log");

              case 6:
                return _context2.abrupt("return", dagNode.write(ipfs, 'dag-pb', log.toJSON(), IPLD_LINKS));

              case 7:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function toMultihash(_x3, _x4) {
        return _toMultihash.apply(this, arguments);
      }

      return toMultihash;
    }()
    /**
     * Create a log from a CID.
     * @param {IPFS} ipfs An IPFS instance
     * @param {string} cid The CID of the log
     * @param {Object} options
     * @param {number} options.length How many items to include in the log
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(cid, entry, parent, depth)} options.onProgressCallback
     */

  }, {
    key: "fromCID",
    value: function () {
      var _fromCID = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee3(ipfs, cid) {
        var _ref,
            _ref$length,
            length,
            exclude,
            onProgressCallback,
            logData,
            entries,
            clock,
            finalEntries,
            heads,
            _args3 = arguments;

        return _regenerator.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _ref = _args3.length > 2 && _args3[2] !== undefined ? _args3[2] : {}, _ref$length = _ref.length, length = _ref$length === void 0 ? -1 : _ref$length, exclude = _ref.exclude, onProgressCallback = _ref.onProgressCallback;

                if (isDefined(ipfs)) {
                  _context3.next = 3;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 3:
                if (isDefined(cid)) {
                  _context3.next = 5;
                  break;
                }

                throw new Error("Invalid CID: ".concat(cid));

              case 5:
                _context3.next = 7;
                return dagNode.read(ipfs, cid, IPLD_LINKS);

              case 7:
                logData = _context3.sent;

                if (!(!logData.heads || !logData.id)) {
                  _context3.next = 10;
                  break;
                }

                throw LogError.NotALogError();

              case 10:
                _context3.next = 12;
                return EntryIO.fetchAll(ipfs, logData.heads, {
                  length: length,
                  exclude: exclude,
                  onProgressCallback: onProgressCallback
                });

              case 12:
                entries = _context3.sent;
                // Find latest clock
                clock = entries.reduce(function (clock, entry) {
                  if (entry.clock.time > clock.time) {
                    return new Clock(entry.clock.id, entry.clock.time);
                  }

                  return clock;
                }, new Clock(logData.id));
                finalEntries = entries.slice().sort(Entry.compare);
                heads = finalEntries.filter(function (e) {
                  return logData.heads.includes(e.cid);
                });
                return _context3.abrupt("return", {
                  id: logData.id,
                  values: finalEntries,
                  heads: heads,
                  clock: clock
                });

              case 17:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function fromCID(_x5, _x6) {
        return _fromCID.apply(this, arguments);
      }

      return fromCID;
    }()
    /**
     * Create a log from an entry CID.
     * @param {IPFS} ipfs An IPFS instance
     * @param {string} entryCid The CID of the entry
     * @param {Object} options
     * @param {number} options.length How many items to include in the log
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(cid, entry, parent, depth)} options.onProgressCallback
     */

  }, {
    key: "fromEntryCid",
    value: function () {
      var _fromEntryCid = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee4(ipfs, entryCid, _ref2) {
        var _ref2$length, length, exclude, onProgressCallback, entryCids, entries, sliced;

        return _regenerator.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _ref2$length = _ref2.length, length = _ref2$length === void 0 ? -1 : _ref2$length, exclude = _ref2.exclude, onProgressCallback = _ref2.onProgressCallback;

                if (isDefined(ipfs)) {
                  _context4.next = 3;
                  break;
                }

                throw LogError.IpfsNotDefinedError();

              case 3:
                if (isDefined(entryCid)) {
                  _context4.next = 5;
                  break;
                }

                throw new Error("'entryCid' must be defined");

              case 5:
                // Convert input cid(s) to an array
                entryCids = Array.isArray(entryCid) ? entryCid : [entryCid]; // Fetch given length, return size at least the given input entries

                length = length > -1 ? Math.max(length, 1) : length;
                _context4.next = 9;
                return EntryIO.fetchParallel(ipfs, entryCids, {
                  length: length,
                  exclude: exclude,
                  onProgressCallback: onProgressCallback
                });

              case 9:
                entries = _context4.sent;
                // Cap the result at the right size by taking the last n entries,
                // or if given length is -1, then take all
                sliced = length > -1 ? last(entries, length) : entries;
                return _context4.abrupt("return", {
                  values: sliced
                });

              case 12:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function fromEntryCid(_x7, _x8, _x9) {
        return _fromEntryCid.apply(this, arguments);
      }

      return fromEntryCid;
    }()
    /**
     * Creates a log data from a JSON object, to be passed to a Log constructor
     *
     * @param {IPFS} ipfs An IPFS instance
     * @param {json} json A json object containing valid log data
     * @param {Object} options
     * @param {number} options.length How many entries to include
     * @param {number} options.timeout Maximum time to wait for each fetch operation, in ms
     * @param {function(cid, entry, parent, depth)} options.onProgressCallback
     **/

  }, {
    key: "fromJSON",
    value: function () {
      var _fromJSON = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee5(ipfs, json, _ref3) {
        var _ref3$length, length, timeout, onProgressCallback, headCids, entries, finalEntries;

        return _regenerator.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _ref3$length = _ref3.length, length = _ref3$length === void 0 ? -1 : _ref3$length, timeout = _ref3.timeout, onProgressCallback = _ref3.onProgressCallback;

                if (isDefined(ipfs)) {
                  _context5.next = 3;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 3:
                json.heads.forEach(Entry.ensureInterop);
                headCids = json.heads.map(function (e) {
                  return e.cid;
                });
                _context5.next = 7;
                return EntryIO.fetchParallel(ipfs, headCids, {
                  length: length,
                  exclude: [],
                  concurrency: 16,
                  timeout: timeout,
                  onProgressCallback: onProgressCallback
                });

              case 7:
                entries = _context5.sent;
                finalEntries = entries.slice().sort(Entry.compare);
                return _context5.abrupt("return", {
                  id: json.id,
                  values: finalEntries,
                  heads: json.heads
                });

              case 10:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function fromJSON(_x10, _x11, _x12) {
        return _fromJSON.apply(this, arguments);
      }

      return fromJSON;
    }()
    /**
     * Create a new log starting from an entry.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Entry|Array<Entry>} sourceEntries An entry or an array of entries to fetch a log from
     * @param {Object} options
     * @param {number} options.length How many entries to include
     * @param {Array<Entry>} options.exclude Entries to not fetch (cached)
     * @param {function(cid, entry, parent, depth)} options.onProgressCallback
     */

  }, {
    key: "fromEntry",
    value: function () {
      var _fromEntry = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee6(ipfs, sourceEntries, _ref4) {
        var _ref4$length, length, exclude, onProgressCallback, hashes, entries, combined, uniques, sliced, missingSourceEntries, replaceInFront, result;

        return _regenerator.default.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _ref4$length = _ref4.length, length = _ref4$length === void 0 ? -1 : _ref4$length, exclude = _ref4.exclude, onProgressCallback = _ref4.onProgressCallback;

                if (isDefined(ipfs)) {
                  _context6.next = 3;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 3:
                if (isDefined(sourceEntries)) {
                  _context6.next = 5;
                  break;
                }

                throw new Error("'sourceEntries' must be defined");

              case 5:
                if (!(!Array.isArray(sourceEntries) && !Entry.isEntry(sourceEntries))) {
                  _context6.next = 7;
                  break;
                }

                throw new Error("'sourceEntries' argument must be an array of Entry instances or a single Entry");

              case 7:
                if (!Array.isArray(sourceEntries)) {
                  sourceEntries = [sourceEntries];
                }

                sourceEntries.forEach(Entry.ensureInterop); // Fetch given length, return size at least the given input entries

                length = length > -1 ? Math.max(length, sourceEntries.length) : length; // Make sure we pass cids instead of objects to the fetcher function

                hashes = sourceEntries.map(function (e) {
                  return e.cid;
                }); // Fetch the entries

                _context6.next = 13;
                return EntryIO.fetchParallel(ipfs, hashes, {
                  length: length,
                  exclude: exclude,
                  onProgressCallback: onProgressCallback
                });

              case 13:
                entries = _context6.sent;
                // Combine the fetches with the source entries and take only uniques
                combined = sourceEntries.concat(entries);
                uniques = findUniques(combined, 'cid').sort(Entry.compare); // Cap the result at the right size by taking the last n entries

                sliced = uniques.slice(length > -1 ? -length : -uniques.length); // Make sure that the given input entries are present in the result
                // in order to not lose references

                missingSourceEntries = difference(sliced, sourceEntries, 'cid');

                replaceInFront = function replaceInFront(a, withEntries) {
                  var sliced = a.slice(withEntries.length, a.length);
                  return withEntries.concat(sliced);
                }; // Add the input entries at the beginning of the array and remove
                // as many elements from the array before inserting the original entries


                result = replaceInFront(sliced, missingSourceEntries);
                return _context6.abrupt("return", {
                  id: result[result.length - 1].id,
                  values: result
                });

              case 21:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function fromEntry(_x13, _x14, _x15) {
        return _fromEntry.apply(this, arguments);
      }

      return fromEntry;
    }()
  }]);
  return LogIO;
}();

module.exports = LogIO;