'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isDefined = require('../utils/is-defined');
var LogIO = require('../log-io');

var createLog = function createLog(ipfs, id, entries, heads, clock, acl, identity) {
  if (!isDefined(ipfs)) throw LogError.ImmutableDBNotDefinedError();
  if (!isDefined(id)) throw new Error('Log id is required, cannot create log');
  if (!isDefined(acl)) throw new Error('ACL is required, cannot create log');
  if (!isDefined(identity)) throw new Error('Identity is required, cannot create log');

  // NOTE: Avoid circular dependency
  return function () {
    var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(Log) {
      var log;
      return _regenerator2.default.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              log = new Log(ipfs, id, entries, heads, clock, acl, identity);
              _context.next = 3;
              return log.validate(entries);

            case 3:
              return _context.abrupt('return', log);

            case 4:
            case 'end':
              return _context.stop();
          }
        }
      }, _callee, undefined);
    }));

    return function (_x) {
      return _ref.apply(this, arguments);
    };
  }();
};

/**
 * Create a log from multihash
 * @param {IPFS}   ipfs        An IPFS instance
 * @param {string} hash        Multihash (as a Base58 encoded string) to create the log from
 * @param {Number} [length=-1] How many items to include in the log
 * @param {Function(hash, entry, parent, depth)} onProgressCallback
 * @return {Promise<Log>}      New Log
 */
var createLogFromMultihash = function () {
  var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(ipfs, hash) {
    var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
    var exclude = arguments[3];
    var acl = arguments[4];
    var identity = arguments[5];
    var onProgressCallback = arguments[6];
    var Log = arguments[7];

    var _ref3, id, entries, heads, clock;

    return _regenerator2.default.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            if (isDefined(hash)) {
              _context2.next = 2;
              break;
            }

            throw new Error('Invalid hash: "' + hash + '", cannot create log');

          case 2:
            _context2.next = 4;
            return LogIO.fromMultihash(ipfs, hash, length, exclude, onProgressCallback);

          case 4:
            _ref3 = _context2.sent;
            id = _ref3.id;
            entries = _ref3.values;
            heads = _ref3.heads;
            clock = _ref3.clock;
            return _context2.abrupt('return', createLog(ipfs, id, entries, heads, clock, acl, identity)(Log));

          case 10:
          case 'end':
            return _context2.stop();
        }
      }
    }, _callee2, undefined);
  }));

  return function createLogFromMultihash(_x3, _x4) {
    return _ref2.apply(this, arguments);
  };
}();

/**
 * Create a log from a single entry's multihash
 * @param {IPFS}   ipfs        An IPFS instance
 * @param {string} hash        Multihash (as a Base58 encoded string) of the Entry from which to create the log from
 * @param {Number} [length=-1] How many entries to include in the log
 * @param {Function(hash, entry, parent, depth)} onProgressCallback
 * @return {Promise<Log>}      New Log
 */
var createLogFromEntryHash = function () {
  var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(ipfs, hash, id) {
    var length = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : -1;
    var exclude = arguments[4];
    var acl = arguments[5];
    var identity = arguments[6];
    var onProgressCallback = arguments[7];
    var Log = arguments[8];

    var _ref5, logId, entries;

    return _regenerator2.default.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            if (isDefined(hash)) {
              _context3.next = 2;
              break;
            }

            throw new Error('Invalid entry hash: "' + hash + '", cannot create log');

          case 2:
            _context3.next = 4;
            return LogIO.fromEntryHash(ipfs, hash, id, length, exclude, onProgressCallback);

          case 4:
            _ref5 = _context3.sent;
            logId = _ref5.id;
            entries = _ref5.values;
            return _context3.abrupt('return', createLog(ipfs, id, entries, null, null, acl, identity)(Log));

          case 8:
          case 'end':
            return _context3.stop();
        }
      }
    }, _callee3, undefined);
  }));

  return function createLogFromEntryHash(_x6, _x7, _x8) {
    return _ref4.apply(this, arguments);
  };
}();

/**
 * Create a log from a Log Snapshot JSON
 * @param {IPFS} ipfs          An IPFS instance
 * @param {Object} json        Log snapshot as JSON object
 * @param {Number} [length=-1] How many entries to include in the log
 * @param {Function(hash, entry, parent, depth)} [onProgressCallback]
 * @return {Promise<Log>}      New Log
 */
var createLogFromJSON = function () {
  var _ref6 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(ipfs, json) {
    var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
    var acl = arguments[3];
    var identity = arguments[4];
    var timeout = arguments[5];
    var onProgressCallback = arguments[6];
    var Log = arguments[7];

    var _ref7, id, entries;

    return _regenerator2.default.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            if (isDefined(json)) {
              _context4.next = 2;
              break;
            }

            throw new Error('Invalid object, cannot create log');

          case 2:
            _context4.next = 4;
            return LogIO.fromJSON(ipfs, json, length, timeout, onProgressCallback);

          case 4:
            _ref7 = _context4.sent;
            id = _ref7.id;
            entries = _ref7.values;
            return _context4.abrupt('return', createLog(ipfs, id, entries, null, null, acl, identity)(Log));

          case 8:
          case 'end':
            return _context4.stop();
        }
      }
    }, _callee4, undefined);
  }));

  return function createLogFromJSON(_x10, _x11) {
    return _ref6.apply(this, arguments);
  };
}();

/**
 * Create a new log from an Entry instance
 * @param {IPFS}                ipfs          An IPFS instance
 * @param {Entry|Array<Entry>}  sourceEntries An Entry or an array of entries to fetch a log from
 * @param {Number}              [length=-1]   How many entries to include. Default: infinite.
 * @param {Array<Entry|string>} [exclude]     Array of entries or hashes or entries to not fetch (foe eg. cached entries)
 * @param {Function(hash, entry, parent, depth)} [onProgressCallback]
 * @return {Promise<Log>}       New Log
 */
var createLogFromEntry = function () {
  var _ref8 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee5(ipfs, sourceEntries) {
    var length = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : -1;
    var exclude = arguments[3];
    var acl = arguments[4];
    var identity = arguments[5];
    var onProgressCallback = arguments[6];
    var Log = arguments[7];

    var _ref9, id, entries;

    return _regenerator2.default.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            if (isDefined(sourceEntries)) {
              _context5.next = 2;
              break;
            }

            throw new Error("Entries are required, cannot create log");

          case 2:
            _context5.next = 4;
            return LogIO.fromEntry(ipfs, sourceEntries, length, exclude, onProgressCallback);

          case 4:
            _ref9 = _context5.sent;
            id = _ref9.id;
            entries = _ref9.values;
            return _context5.abrupt('return', createLog(ipfs, id, entries, null, null, acl, identity)(Log));

          case 8:
          case 'end':
            return _context5.stop();
        }
      }
    }, _callee5, undefined);
  }));

  return function createLogFromEntry(_x13, _x14) {
    return _ref8.apply(this, arguments);
  };
}();

module.exports = {
  createLogFromEntry: createLogFromEntry,
  createLogFromEntryHash: createLogFromEntryHash,
  createLogFromMultihash: createLogFromMultihash,
  createLogFromJSON: createLogFromJSON
};