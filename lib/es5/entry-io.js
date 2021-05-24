'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var pMap = require('p-map');

var pDoWhilst = require('p-do-whilst');

var Entry = require('./entry');

var hasItems = function hasItems(arr) {
  return arr && arr.length > 0;
};

var EntryIO = /*#__PURE__*/function () {
  function EntryIO() {
    (0, _classCallCheck2["default"])(this, EntryIO);
  }

  (0, _createClass2["default"])(EntryIO, null, [{
    key: "fetchParallel",
    value: // Fetch log graphs in parallel
    function () {
      var _fetchParallel = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2(ipfs, hashes, _ref) {
        var length, _ref$exclude, exclude, timeout, concurrency, onProgressCallback, fetchOne, concatArrays, flatten, res;

        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                length = _ref.length, _ref$exclude = _ref.exclude, exclude = _ref$exclude === void 0 ? [] : _ref$exclude, timeout = _ref.timeout, concurrency = _ref.concurrency, onProgressCallback = _ref.onProgressCallback;

                fetchOne = /*#__PURE__*/function () {
                  var _ref2 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(hash) {
                    return _regenerator["default"].wrap(function _callee$(_context) {
                      while (1) {
                        switch (_context.prev = _context.next) {
                          case 0:
                            return _context.abrupt("return", EntryIO.fetchAll(ipfs, hash, {
                              length: length,
                              exclude: exclude,
                              timeout: timeout,
                              onProgressCallback: onProgressCallback,
                              concurrency: concurrency
                            }));

                          case 1:
                          case "end":
                            return _context.stop();
                        }
                      }
                    }, _callee);
                  }));

                  return function fetchOne(_x4) {
                    return _ref2.apply(this, arguments);
                  };
                }();

                concatArrays = function concatArrays(arr1, arr2) {
                  return arr1.concat(arr2);
                };

                flatten = function flatten(arr) {
                  return arr.reduce(concatArrays, []);
                };

                _context2.next = 6;
                return pMap(hashes, fetchOne, {
                  concurrency: Math.max(concurrency || hashes.length, 1)
                });

              case 6:
                res = _context2.sent;
                return _context2.abrupt("return", flatten(res));

              case 8:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }));

      function fetchParallel(_x, _x2, _x3) {
        return _fetchParallel.apply(this, arguments);
      }

      return fetchParallel;
    }()
    /**
     * Fetch log entries
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
    key: "fetchAll",
    value: function () {
      var _fetchAll = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee6(ipfs, hashes) {
        var _ref3,
            _ref3$length,
            length,
            _ref3$exclude,
            exclude,
            timeout,
            onProgressCallback,
            onStartProgressCallback,
            _ref3$concurrency,
            concurrency,
            _ref3$delay,
            delay,
            result,
            cache,
            loadingCache,
            loadingQueue,
            running,
            maxClock,
            minClock,
            loadingQueueHasMore,
            addToLoadingQueue,
            getNextFromQueue,
            addToExcludeCache,
            fetchEntry,
            _processQueue,
            _args6 = arguments;

        return _regenerator["default"].wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _ref3 = _args6.length > 2 && _args6[2] !== undefined ? _args6[2] : {}, _ref3$length = _ref3.length, length = _ref3$length === void 0 ? -1 : _ref3$length, _ref3$exclude = _ref3.exclude, exclude = _ref3$exclude === void 0 ? [] : _ref3$exclude, timeout = _ref3.timeout, onProgressCallback = _ref3.onProgressCallback, onStartProgressCallback = _ref3.onStartProgressCallback, _ref3$concurrency = _ref3.concurrency, concurrency = _ref3$concurrency === void 0 ? 32 : _ref3$concurrency, _ref3$delay = _ref3.delay, delay = _ref3$delay === void 0 ? 0 : _ref3$delay;
                result = [];
                cache = {};
                loadingCache = {};
                loadingQueue = Array.isArray(hashes) ? {
                  0: hashes.slice()
                } : {
                  0: [hashes]
                };
                running = 0; // keep track of how many entries are being fetched at any time

                maxClock = 0; // keep track of the latest clock time during load

                minClock = 0; // keep track of the minimum clock time during load
                // Does the loading queue have more to process?

                loadingQueueHasMore = function loadingQueueHasMore() {
                  return Object.values(loadingQueue).find(hasItems) !== undefined;
                }; // Add a multihash to the loading queue


                addToLoadingQueue = function addToLoadingQueue(e, idx) {
                  if (!loadingCache[e]) {
                    if (!loadingQueue[idx]) loadingQueue[idx] = [];

                    if (!loadingQueue[idx].includes(e)) {
                      loadingQueue[idx].push(e);
                    }

                    loadingCache[e] = true;
                  }
                }; // Get the next items to process from the loading queue


                getNextFromQueue = function getNextFromQueue() {
                  var length = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 1;

                  var getNext = function getNext(res, key, idx) {
                    var nextItems = loadingQueue[key];

                    while (nextItems.length > 0 && res.length < length) {
                      var hash = nextItems.shift();
                      res.push(hash);
                    }

                    if (nextItems.length === 0) {
                      delete loadingQueue[key];
                    }

                    return res;
                  };

                  return Object.keys(loadingQueue).reduce(getNext, []);
                }; // Add entries that we don't need to fetch to the "cache"


                addToExcludeCache = function addToExcludeCache(e) {
                  cache[e.hash] = true;
                }; // Fetch one entry and add it to the results


                fetchEntry = /*#__PURE__*/function () {
                  var _ref4 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4(hash) {
                    return _regenerator["default"].wrap(function _callee4$(_context4) {
                      while (1) {
                        switch (_context4.prev = _context4.next) {
                          case 0:
                            if (!(!hash || cache[hash])) {
                              _context4.next = 2;
                              break;
                            }

                            return _context4.abrupt("return");

                          case 2:
                            return _context4.abrupt("return", new Promise(function (resolve, reject) {
                              // Resolve the promise after a timeout (if given) in order to
                              // not get stuck loading a block that is unreachable
                              var timer = timeout && timeout > 0 ? setTimeout(function () {
                                console.warn("Warning: Couldn't fetch entry '".concat(hash, "', request timed out (").concat(timeout, "ms)"));
                                resolve();
                              }, timeout) : null;

                              var addToResults = function addToResults(entry) {
                                if (Entry.isEntry(entry)) {
                                  var ts = entry.clock.time; // Update min/max clocks

                                  // Update min/max clocks
                                  maxClock = Math.max(maxClock, ts);
                                  minClock = result.length > 0 ? Math.min(result[result.length - 1].clock.time, minClock) : maxClock;
                                  var isLater = result.length >= length && ts >= minClock;

                                  var calculateIndex = function calculateIndex(idx) {
                                    return maxClock - ts + (idx + 1) * idx;
                                  }; // Add the entry to the results if
                                  // 1) we're fetching all entries
                                  // 2) results is not filled yet
                                  // the clock of the entry is later than current known minimum clock time


                                  // Add the entry to the results if
                                  // 1) we're fetching all entries
                                  // 2) results is not filled yet
                                  // the clock of the entry is later than current known minimum clock time
                                  if (length < 0 || result.length < length || isLater) {
                                    result.push(entry);
                                    cache[hash] = true;

                                    if (onProgressCallback) {
                                      onProgressCallback(hash, entry, result.length, result.length);
                                    }
                                  }

                                  if (length < 0) {
                                    // If we're fetching all entries (length === -1), adds nexts and refs to the queue
                                    entry.next.forEach(addToLoadingQueue);
                                    if (entry.refs) entry.refs.forEach(addToLoadingQueue);
                                  } else {
                                    // If we're fetching entries up to certain length,
                                    // fetch the next if result is filled up, to make sure we "check"
                                    // the next entry if its clock is later than what we have in the result
                                    if (result.length < length || ts > minClock || ts === minClock && !cache[entry.hash]) {
                                      entry.next.forEach(function (e) {
                                        return addToLoadingQueue(e, calculateIndex(0));
                                      });
                                    }

                                    if (entry.refs && result.length + entry.refs.length <= length) {
                                      entry.refs.forEach(function (e, i) {
                                        return addToLoadingQueue(e, calculateIndex(i));
                                      });
                                    }
                                  }
                                }
                              };

                              if (onStartProgressCallback) {
                                onStartProgressCallback(hash, null, 0, result.length);
                              } // Load the entry


                              // Load the entry
                              Entry.fromMultihash(ipfs, hash).then( /*#__PURE__*/function () {
                                var _ref5 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3(entry) {
                                  var sleep;
                                  return _regenerator["default"].wrap(function _callee3$(_context3) {
                                    while (1) {
                                      switch (_context3.prev = _context3.next) {
                                        case 0:
                                          _context3.prev = 0;
                                          // Add it to the results
                                          addToResults(entry); // Simulate network latency (for debugging purposes)

                                          if (!(delay > 0)) {
                                            _context3.next = 6;
                                            break;
                                          }

                                          sleep = function sleep() {
                                            var ms = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
                                            return new Promise(function (resolve) {
                                              return setTimeout(resolve, ms);
                                            });
                                          };

                                          _context3.next = 6;
                                          return sleep(delay);

                                        case 6:
                                          resolve();
                                          _context3.next = 12;
                                          break;

                                        case 9:
                                          _context3.prev = 9;
                                          _context3.t0 = _context3["catch"](0);
                                          reject(_context3.t0);

                                        case 12:
                                          _context3.prev = 12;
                                          clearTimeout(timer);
                                          return _context3.finish(12);

                                        case 15:
                                        case "end":
                                          return _context3.stop();
                                      }
                                    }
                                  }, _callee3, null, [[0, 9, 12, 15]]);
                                }));

                                return function (_x8) {
                                  return _ref5.apply(this, arguments);
                                };
                              }())["catch"](reject);
                            }));

                          case 3:
                          case "end":
                            return _context4.stop();
                        }
                      }
                    }, _callee4);
                  }));

                  return function fetchEntry(_x7) {
                    return _ref4.apply(this, arguments);
                  };
                }(); // One loop of processing the loading queue


                _processQueue = /*#__PURE__*/function () {
                  var _ref6 = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee5() {
                    var nexts;
                    return _regenerator["default"].wrap(function _callee5$(_context5) {
                      while (1) {
                        switch (_context5.prev = _context5.next) {
                          case 0:
                            if (!(running < concurrency)) {
                              _context5.next = 6;
                              break;
                            }

                            nexts = getNextFromQueue(concurrency);
                            running += nexts.length;
                            _context5.next = 5;
                            return pMap(nexts, fetchEntry);

                          case 5:
                            running -= nexts.length;

                          case 6:
                          case "end":
                            return _context5.stop();
                        }
                      }
                    }, _callee5);
                  }));

                  return function _processQueue() {
                    return _ref6.apply(this, arguments);
                  };
                }(); // Add entries to exclude from processing to the cache before we start


                exclude.forEach(addToExcludeCache); // Fetch entries

                _context6.next = 17;
                return pDoWhilst(_processQueue, loadingQueueHasMore);

              case 17:
                return _context6.abrupt("return", result);

              case 18:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6);
      }));

      function fetchAll(_x5, _x6) {
        return _fetchAll.apply(this, arguments);
      }

      return fetchAll;
    }()
  }]);
  return EntryIO;
}();

module.exports = EntryIO;