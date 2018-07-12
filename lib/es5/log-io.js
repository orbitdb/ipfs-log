'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var pMap = require('p-map');
var Entry = require('./entry');
var EntryIO = require('./entry-io');
var Clock = require('./lamport-clock');
var LogError = require('./log-errors');
var isDefined = require('./utils/is-defined');
var _uniques = require('./utils/uniques');
var intersection = require('./utils/intersection');
var difference = require('./utils/difference');

var last = function last(arr, n) {
  return arr.slice(arr.length - n, arr.length);
};

var LogIO = function () {
  function LogIO() {
    (0, _classCallCheck3.default)(this, LogIO);
  }

  (0, _createClass3.default)(LogIO, null, [{
    key: 'toMultihash',
    value: function toMultihash(immutabledb, log) {
      if (!isDefined(immutabledb)) throw LogError.ImmutableDBNotDefinedError();
      if (!isDefined(log)) throw LogError.LogNotDefinedError();

      if (log.values.length < 1) throw new Error('Can\'t serialize an empty log');
      // return this._storage.put(this.toBuffer())
      return immutabledb.object.put(log.toBuffer()).then(function (dagNode) {
        return dagNode.toJSON().multihash;
      });
    }

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
    value: function fromMultihash(immutabledb, hash) {
      var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
      var exclude = arguments[3];
      var onProgressCallback = arguments[4];

      if (!isDefined(immutabledb)) throw LogError.ImmutableDBNotDefinedError();
      if (!isDefined(hash)) throw new Error('Invalid hash: ' + hash);

      return immutabledb.object.get(hash, { enc: 'base58' }).then(function (dagNode) {
        return JSON.parse(dagNode.toJSON().data);
      })
      // return immutabledb.get(hash)
      .then(function (logData) {
        if (!logData.heads || !logData.id) throw LogError.NotALogError();
        return EntryIO.fetchAll(immutabledb, logData.heads, length, exclude, null, onProgressCallback).then(function (entries) {
          // Find latest clock
          var clock = entries.reduce(function (clock, entry) {
            if (entry.clock.time > clock.time) {
              return new Clock(entry.clock.id, entry.clock.time);
            }
            return clock;
          }, new Clock(logData.id));
          var finalEntries = entries.slice().sort(Entry.compare);
          var heads = finalEntries.filter(function (e) {
            return logData.heads.includes(e.hash);
          });
          return {
            id: logData.id,
            values: finalEntries,
            heads: heads,
            clock: clock
          };
        });
      });
    }
  }, {
    key: 'fromEntryHash',
    value: function fromEntryHash(ipfs, entryHash, id) {
      var length = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : -1;
      var exclude = arguments[4];
      var onProgressCallback = arguments[5];

      if (!isDefined(ipfs)) throw LogError.IpfsNotDefinedError();
      if (!isDefined(entryHash)) throw new Error("'entryHash' must be defined");

      // Fetch given length, return size at least the given input entries
      length = length > -1 ? Math.max(length, 1) : length;

      // Make sure we pass hashes instead of objects to the fetcher function
      var excludeHashes = exclude; // ? exclude.map(e => e.hash ? e.hash : e) : exclude

      return EntryIO.fetchParallel(ipfs, [entryHash], length, excludeHashes, null, null, onProgressCallback).then(function (entries) {
        // Cap the result at the right size by taking the last n entries,
        // or if given length is -1, then take all
        var sliced = length > -1 ? last(entries, length) : entries;
        return {
          values: sliced
        };
      });
    }
  }, {
    key: 'fromJSON',
    value: function fromJSON(ipfs, json) {
      var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
      var timeout = arguments[3];
      var onProgressCallback = arguments[4];

      if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError();
      return EntryIO.fetchParallel(ipfs, json.heads.map(function (e) {
        return e.hash;
      }), length, [], 16, timeout, onProgressCallback).then(function (entries) {
        var finalEntries = entries.slice().sort(Entry.compare);
        var heads = entries.filter(function (e) {
          return json.heads.includes(e.hash);
        });
        return {
          id: json.id,
          values: finalEntries,
          heads: json.heads
        };
      });
    }

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
    value: function fromEntry(immutabledb, sourceEntries) {
      var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
      var exclude = arguments[3];
      var key = arguments[4];
      var keys = arguments[5];
      var onProgressCallback = arguments[6];

      if (!isDefined(immutabledb)) throw LogError.ImmutableDBNotDefinedError();
      if (!isDefined(sourceEntries)) throw new Error("'sourceEntries' must be defined");

      // Make sure we only have Entry objects as input
      if (!Array.isArray(sourceEntries) && !Entry.isEntry(sourceEntries)) {
        throw new Error('\'sourceEntries\' argument must be an array of Entry instances or a single Entry');
      }

      if (!Array.isArray(sourceEntries)) {
        sourceEntries = [sourceEntries];
      }

      // Fetch given length, return size at least the given input entries
      length = length > -1 ? Math.max(length, sourceEntries.length) : length;

      // Make sure we pass hashes instead of objects to the fetcher function
      var excludeHashes = exclude ? exclude.map(function (e) {
        return e.hash ? e.hash : e;
      }) : exclude;
      var hashes = sourceEntries.map(function (e) {
        return e.hash;
      });

      return EntryIO.fetchParallel(immutabledb, hashes, length, excludeHashes, null, null, onProgressCallback).then(function (entries) {
        var combined = sourceEntries.concat(entries);
        var uniques = _uniques(combined, 'hash').sort(Entry.compare);

        // Cap the result at the right size by taking the last n entries
        var sliced = uniques.slice(length > -1 ? -length : -uniques.length);

        // Make sure that the given input entries are present in the result
        // in order to not lose references
        var missingSourceEntries = difference(sliced, sourceEntries, 'hash');

        var replaceInFront = function replaceInFront(a, withEntries) {
          var sliced = a.slice(withEntries.length, a.length);
          return withEntries.concat(sliced);
        };

        // Add the input entries at the beginning of the array and remove
        // as many elements from the array before inserting the original entries
        var result = replaceInFront(sliced, missingSourceEntries);
        return {
          id: result[result.length - 1].id,
          values: result
        };
      });
    }
  }]);
  return LogIO;
}();

module.exports = LogIO;