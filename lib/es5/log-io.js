'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Entry = require('./entry');
var EntryIO = require('./entry-io');
var Clock = require('./lamport-clock');
var LogError = require('./log-errors');

var _require = require('./utils'),
    isDefined = _require.isDefined,
    findUniques = _require.findUniques,
    difference = _require.difference;

var last = function last(arr, n) {
  return arr.slice(arr.length - n, arr.length);
};

var LogIO = function () {
  function LogIO() {
    (0, _classCallCheck3.default)(this, LogIO);
  }

  (0, _createClass3.default)(LogIO, null, [{
    key: 'toMultihash',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(ipfs, log) {
        var dagNode;
        return _regenerator2.default.wrap(function _callee$(_context) {
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

                throw new Error('Can\'t serialize an empty log');

              case 6:
                _context.next = 8;
                return ipfs.object.put(log.toBuffer());

              case 8:
                dagNode = _context.sent;
                return _context.abrupt('return', dagNode.toJSON().multihash);

              case 10:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function toMultihash(_x, _x2) {
        return _ref.apply(this, arguments);
      }

      return toMultihash;
    }()

    /**
     * Create a log from multihash
     * @param {IPFS} ipfs - An IPFS instance
     * @param {string} hash - Multihash (as a Base58 encoded string) to create the log from
     * @param {Number} [length=-1] - How many items to include in the log
     * @param {function(hash, entry, parent, depth)} onProgressCallback
     * @returns {Promise<Log>}
     */

  }, {
    key: 'fromMultihash',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(ipfs, hash) {
        var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
        var exclude = arguments[3];
        var onProgressCallback = arguments[4];
        var dagNode, logData, entries, clock, finalEntries, heads;
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                if (isDefined(ipfs)) {
                  _context2.next = 2;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 2:
                if (isDefined(hash)) {
                  _context2.next = 4;
                  break;
                }

                throw new Error('Invalid hash: ' + hash);

              case 4:
                _context2.next = 6;
                return ipfs.object.get(hash, { enc: 'base58' });

              case 6:
                dagNode = _context2.sent;
                logData = JSON.parse(dagNode.toJSON().data);

                if (!(!logData.heads || !logData.id)) {
                  _context2.next = 10;
                  break;
                }

                throw LogError.NotALogError();

              case 10:
                _context2.next = 12;
                return EntryIO.fetchAll(ipfs, logData.heads, length, exclude, null, onProgressCallback);

              case 12:
                entries = _context2.sent;


                // Find latest clock
                clock = entries.reduce(function (clock, entry) {
                  if (entry.clock.time > clock.time) {
                    return new Clock(entry.clock.id, entry.clock.time);
                  }
                  return clock;
                }, new Clock(logData.id));
                finalEntries = entries.slice().sort(Entry.compare);
                heads = finalEntries.filter(function (e) {
                  return logData.heads.includes(e.hash);
                });
                return _context2.abrupt('return', {
                  id: logData.id,
                  values: finalEntries,
                  heads: heads,
                  clock: clock
                });

              case 17:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function fromMultihash(_x4, _x5) {
        return _ref2.apply(this, arguments);
      }

      return fromMultihash;
    }()
  }, {
    key: 'fromEntryHash',
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(ipfs, entryHash, id) {
        var length = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : -1;
        var exclude = arguments[4];
        var onProgressCallback = arguments[5];
        var excludeHashes, entries, sliced;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (isDefined(ipfs)) {
                  _context3.next = 2;
                  break;
                }

                throw LogError.IpfsNotDefinedError();

              case 2:
                if (isDefined(entryHash)) {
                  _context3.next = 4;
                  break;
                }

                throw new Error("'entryHash' must be defined");

              case 4:

                // Fetch given length, return size at least the given input entries
                length = length > -1 ? Math.max(length, 1) : length;

                // Make sure we pass hashes instead of objects to the fetcher function
                excludeHashes = exclude; // ? exclude.map(e => e.hash ? e.hash : e) : exclude

                _context3.next = 8;
                return EntryIO.fetchParallel(ipfs, [entryHash], length, excludeHashes, null, null, onProgressCallback);

              case 8:
                entries = _context3.sent;

                // Cap the result at the right size by taking the last n entries,
                // or if given length is -1, then take all
                sliced = length > -1 ? last(entries, length) : entries;
                return _context3.abrupt('return', {
                  values: sliced
                });

              case 11:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function fromEntryHash(_x7, _x8, _x9) {
        return _ref3.apply(this, arguments);
      }

      return fromEntryHash;
    }()
  }, {
    key: 'fromJSON',
    value: function () {
      var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(ipfs, json) {
        var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
        var timeout = arguments[3];
        var onProgressCallback = arguments[4];
        var headHashes, entries, finalEntries;
        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (isDefined(ipfs)) {
                  _context4.next = 2;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 2:
                headHashes = json.heads.map(function (e) {
                  return e.hash;
                });
                _context4.next = 5;
                return EntryIO.fetchParallel(ipfs, headHashes, length, [], 16, timeout, onProgressCallback);

              case 5:
                entries = _context4.sent;
                finalEntries = entries.slice().sort(Entry.compare);
                return _context4.abrupt('return', {
                  id: json.id,
                  values: finalEntries,
                  heads: json.heads
                });

              case 8:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function fromJSON(_x11, _x12) {
        return _ref4.apply(this, arguments);
      }

      return fromJSON;
    }()

    /**
     * Create a new log starting from an entry
     * @param {IPFS} ipfs An IPFS instance
     * @param {Array<Entry>} entries An entry or an array of entries to fetch a log from
     * @param {Number} [length=-1] How many entries to include. Default: infinite.
     * @param {Array<Entry|string>} [exclude] Entries to not fetch (cached)
     * @param {function(hash, entry, parent, depth)} [onProgressCallback]
     * @returns {Promise<Log>}
     */

  }, {
    key: 'fromEntry',
    value: function () {
      var _ref5 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(ipfs, sourceEntries) {
        var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
        var exclude = arguments[3];
        var onProgressCallback = arguments[4];
        var excludeHashes, hashes, entries, combined, uniques, sliced, missingSourceEntries, replaceInFront, result;
        return _regenerator2.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                if (isDefined(ipfs)) {
                  _context5.next = 2;
                  break;
                }

                throw LogError.IPFSNotDefinedError();

              case 2:
                if (isDefined(sourceEntries)) {
                  _context5.next = 4;
                  break;
                }

                throw new Error("'sourceEntries' must be defined");

              case 4:
                if (!(!Array.isArray(sourceEntries) && !Entry.isEntry(sourceEntries))) {
                  _context5.next = 6;
                  break;
                }

                throw new Error('\'sourceEntries\' argument must be an array of Entry instances or a single Entry');

              case 6:

                if (!Array.isArray(sourceEntries)) {
                  sourceEntries = [sourceEntries];
                }

                // Fetch given length, return size at least the given input entries
                length = length > -1 ? Math.max(length, sourceEntries.length) : length;

                // Make sure we pass hashes instead of objects to the fetcher function
                excludeHashes = exclude ? exclude.map(function (e) {
                  return e.hash ? e.hash : e;
                }) : exclude;
                hashes = sourceEntries.map(function (e) {
                  return e.hash;
                });

                // Fetch the entries

                _context5.next = 12;
                return EntryIO.fetchParallel(ipfs, hashes, length, excludeHashes, null, null, onProgressCallback);

              case 12:
                entries = _context5.sent;


                // Combine the fetches with the source entries and take only uniques
                combined = sourceEntries.concat(entries);
                uniques = findUniques(combined, 'hash').sort(Entry.compare);

                // Cap the result at the right size by taking the last n entries

                sliced = uniques.slice(length > -1 ? -length : -uniques.length);

                // Make sure that the given input entries are present in the result
                // in order to not lose references

                missingSourceEntries = difference(sliced, sourceEntries, 'hash');

                replaceInFront = function replaceInFront(a, withEntries) {
                  var sliced = a.slice(withEntries.length, a.length);
                  return withEntries.concat(sliced);
                };

                // Add the input entries at the beginning of the array and remove
                // as many elements from the array before inserting the original entries


                result = replaceInFront(sliced, missingSourceEntries);
                return _context5.abrupt('return', {
                  id: result[result.length - 1].id,
                  values: result
                });

              case 20:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function fromEntry(_x14, _x15) {
        return _ref5.apply(this, arguments);
      }

      return fromEntry;
    }()
  }]);
  return LogIO;
}();

module.exports = LogIO;