'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var pWhilst = require('p-whilst');

var pMap = require('p-map');

var Entry = require('./entry');

var EntryIO =
/*#__PURE__*/
function () {
  function EntryIO() {
    (0, _classCallCheck2.default)(this, EntryIO);
  }

  (0, _createClass2.default)(EntryIO, null, [{
    key: "fetchParallel",

    /**
     * Fetch log entries in parallel.
     * @param {IPFS} ipfs An IPFS instance
     * @param {string|Array<string>} cids CIDs of the entries to fetch
     * @param {Object} options
     * @param {number} options.length How many entries to fetch
     * @param {Array<Entry>} options.exclude Entries to not fetch
     * @param {number} options.concurrency Max concurrent fetch operations
     * @param {number} options.timeout Maximum time to wait for each fetch operation, in ms
     * @param {function(cid, entry, parent, depth)} options.onProgressCallback
     * @returns {Promise<Array<Entry>>}
     */
    value: function () {
      var _fetchParallel = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee(ipfs, cids) {
        var _ref,
            _ref$length,
            length,
            _ref$exclude,
            exclude,
            _ref$concurrency,
            concurrency,
            timeout,
            onProgressCallback,
            fetchOne,
            getHashes,
            uniquelyConcatArrays,
            flatten,
            entries,
            _args = arguments;

        return _regenerator.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _ref = _args.length > 2 && _args[2] !== undefined ? _args[2] : {}, _ref$length = _ref.length, length = _ref$length === void 0 ? -1 : _ref$length, _ref$exclude = _ref.exclude, exclude = _ref$exclude === void 0 ? [] : _ref$exclude, _ref$concurrency = _ref.concurrency, concurrency = _ref$concurrency === void 0 ? null : _ref$concurrency, timeout = _ref.timeout, onProgressCallback = _ref.onProgressCallback;

                fetchOne = function fetchOne(cid) {
                  return EntryIO.fetchAll(ipfs, cid, {
                    length: length,
                    exclude: exclude,
                    timeout: timeout,
                    onProgressCallback: onProgressCallback
                  });
                };

                getHashes = function getHashes(e) {
                  return e.hash;
                };

                uniquelyConcatArrays = function uniquelyConcatArrays(arr1, arr2) {
                  // Add any new entries to arr1
                  var hashes = arr1.map(getHashes);
                  arr2.forEach(function (entry) {
                    if (hashes.indexOf(entry.hash) === -1) arr1.push(entry);
                  });
                  return arr1;
                };

                flatten = function flatten(arr) {
                  return arr.reduce(uniquelyConcatArrays, []);
                };

                concurrency = Math.max(concurrency || cids.length, 1);
                _context.next = 8;
                return pMap(cids, fetchOne, {
                  concurrency: concurrency
                });

              case 8:
                entries = _context.sent;
                return _context.abrupt("return", flatten(entries));

              case 10:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function fetchParallel(_x, _x2) {
        return _fetchParallel.apply(this, arguments);
      }

      return fetchParallel;
    }()
    /**
     * Fetch log entries sequentially.
     * @param {IPFS} ipfs An IPFS instance
     * @param {string|Array<string>} cids CIDs of the entries to fetch
     * @param {Object} options
     * @param {number} options.length How many entries to fetch
     * @param {Array<Entry>} options.exclude Entries to not fetch
     * @param {number} options.concurrency Max concurrent fetch operations
     * @param {number} options.timeout Maximum time to wait for each fetch operation, in ms
     * @param {function(cid, entry, parent, depth)} options.onProgressCallback
     * @returns {Promise<Array<Entry>>}
     */

  }, {
    key: "fetchAll",
    value: function () {
      var _fetchAll = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee3(ipfs, cids, _ref2) {
        var _ref2$length, length, _ref2$exclude, exclude, _ref2$timeout, timeout, onProgressCallback, result, cache, loadingQueue, addToLoadingQueue, addToExcludeCache, shouldFetchMore, fetchEntry;

        return _regenerator.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _ref2$length = _ref2.length, length = _ref2$length === void 0 ? -1 : _ref2$length, _ref2$exclude = _ref2.exclude, exclude = _ref2$exclude === void 0 ? [] : _ref2$exclude, _ref2$timeout = _ref2.timeout, timeout = _ref2$timeout === void 0 ? null : _ref2$timeout, onProgressCallback = _ref2.onProgressCallback;
                result = [];
                cache = {};
                loadingQueue = Array.isArray(cids) ? cids.slice() : [cids]; // Add a CID to the loading queue

                addToLoadingQueue = function addToLoadingQueue(e) {
                  return loadingQueue.push(e);
                }; // Add entries that we don't need to fetch to the "cache"


                exclude = exclude && Array.isArray(exclude) ? exclude : [];

                addToExcludeCache = function addToExcludeCache(e) {
                  if (Entry.isEntry(e)) {
                    result.push(e);
                    cache[e.cid] = e;
                  }
                };

                exclude.forEach(addToExcludeCache);

                shouldFetchMore = function shouldFetchMore() {
                  return loadingQueue.length > 0 && (result.length < length || length < 0);
                };

                fetchEntry = function fetchEntry() {
                  var cid = loadingQueue.shift();

                  if (cache[cid]) {
                    return Promise.resolve();
                  }

                  return new Promise(
                  /*#__PURE__*/
                  function () {
                    var _ref3 = (0, _asyncToGenerator2.default)(
                    /*#__PURE__*/
                    _regenerator.default.mark(function _callee2(resolve, reject) {
                      var timer, addToResults, entry;
                      return _regenerator.default.wrap(function _callee2$(_context2) {
                        while (1) {
                          switch (_context2.prev = _context2.next) {
                            case 0:
                              // Resolve the promise after a timeout (if given) in order to
                              // not get stuck loading a block that is unreachable
                              timer = timeout ? setTimeout(function () {
                                console.warn("Warning: Couldn't fetch entry '".concat(cid, "', request timed out (").concat(timeout, "ms)"));
                                resolve();
                              }, timeout) : null;

                              addToResults = function addToResults(entry) {
                                if (Entry.isEntry(entry)) {
                                  entry.next.forEach(addToLoadingQueue);
                                  result.push(entry);
                                  cache[cid] = entry;

                                  if (onProgressCallback) {
                                    onProgressCallback(cid, entry, result.length);
                                  }
                                }
                              }; // Load the entry


                              _context2.prev = 2;
                              _context2.next = 5;
                              return Entry.fromCID(ipfs, cid);

                            case 5:
                              entry = _context2.sent;
                              addToResults(entry);
                              resolve();
                              _context2.next = 13;
                              break;

                            case 10:
                              _context2.prev = 10;
                              _context2.t0 = _context2["catch"](2);
                              reject(_context2.t0);

                            case 13:
                              _context2.prev = 13;
                              clearTimeout(timer);
                              return _context2.finish(13);

                            case 16:
                            case "end":
                              return _context2.stop();
                          }
                        }
                      }, _callee2, this, [[2, 10, 13, 16]]);
                    }));

                    return function (_x6, _x7) {
                      return _ref3.apply(this, arguments);
                    };
                  }());
                };

                _context3.next = 12;
                return pWhilst(shouldFetchMore, fetchEntry);

              case 12:
                return _context3.abrupt("return", result);

              case 13:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function fetchAll(_x3, _x4, _x5) {
        return _fetchAll.apply(this, arguments);
      }

      return fetchAll;
    }()
  }]);
  return EntryIO;
}();

module.exports = EntryIO;