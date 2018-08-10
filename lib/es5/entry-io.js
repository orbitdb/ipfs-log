'use strict';

var _promise = require('babel-runtime/core-js/promise');

var _promise2 = _interopRequireDefault(_promise);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var pWhilst = require('p-whilst');
var pMap = require('p-map');
var Entry = require('./entry');

var EntryIO = function () {
  function EntryIO() {
    (0, _classCallCheck3.default)(this, EntryIO);
  }

  (0, _createClass3.default)(EntryIO, null, [{
    key: 'fetchParallel',

    // Fetch log graphs in parallel
    value: function fetchParallel(ipfs, hashes, length) {
      var exclude = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      var concurrency = arguments[4];
      var timeout = arguments[5];
      var onProgressCallback = arguments[6];

      var fetchOne = function fetchOne(hash) {
        return EntryIO.fetchAll(ipfs, hash, length, exclude, timeout, onProgressCallback);
      };
      var concatArrays = function concatArrays(arr1, arr2) {
        return arr1.concat(arr2);
      };
      var flatten = function flatten(arr) {
        return arr.reduce(concatArrays, []);
      };
      return pMap(hashes, fetchOne, { concurrency: Math.max(concurrency || hashes.length, 1) }).then(flatten); // Flatten the results
    }

    /**
     * Fetch log entries sequentially
     *
     * @param {IPFS} [ipfs] An IPFS instance
     * @param {string} [hash] Multihash of the entry to fetch
     * @param {string} [parent] Parent of the node to be fetched
     * @param {Object} [all] Entries to skip
     * @param {Number} [amount=-1] How many entries to fetch
     * @param {Number} [depth=0] Current depth of the recursion
     * @param {function(hash, entry, parent, depth)} onProgressCallback
     * @returns {Promise<Array<Entry>>}
     */

  }, {
    key: 'fetchAll',
    value: function fetchAll(ipfs, hashes, amount) {
      var exclude = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      var timeout = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;
      var onProgressCallback = arguments[5];

      var result = [];
      var cache = {};
      var loadingQueue = Array.isArray(hashes) ? hashes.slice() : [hashes];

      // Add a multihash to the loading queue
      var addToLoadingQueue = function addToLoadingQueue(e) {
        return loadingQueue.push(e);
      };

      // Add entries that we don't need to fetch to the "cache"
      var addToExcludeCache = function addToExcludeCache(e) {
        return cache[e.hash] = e;
      };
      exclude && exclude.length && exclude.forEach(addToExcludeCache);

      var shouldFetchMore = function shouldFetchMore() {
        return loadingQueue.length > 0 && (result.length < amount || amount < 0);
      };

      var fetchEntry = function fetchEntry() {
        var hash = loadingQueue.shift();

        if (cache[hash]) {
          return _promise2.default.resolve();
        }

        return new _promise2.default(function (resolve, reject) {
          // Resolve the promise after a timeout (if given) in order to
          // not get stuck loading a block that is unreachable
          var timer = timeout ? setTimeout(function () {
            console.warn('Warning: Couldn\'t fetch entry \'' + hash + '\', request timed out (' + timeout + 'ms)');
            resolve();
          }, timeout) : null;

          var addToResults = function addToResults(entry) {
            clearTimeout(timer);
            if (Entry.isEntry(entry)) {
              entry.next.forEach(addToLoadingQueue);
              result.push(entry);
              cache[hash] = entry;
              if (onProgressCallback) {
                onProgressCallback(hash, entry, result.length);
              }
            }
          };

          // Load the entry
          Entry.fromMultihash(ipfs, hash).then(addToResults).then(resolve).catch(function (err) {
            resolve();
          });
        });
      };

      return pWhilst(shouldFetchMore, fetchEntry).then(function () {
        return result;
      });
    }
  }]);
  return EntryIO;
}();

module.exports = EntryIO;