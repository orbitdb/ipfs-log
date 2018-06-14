'use strict';

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var Clock = require('./lamport-clock');
var isDefined = require('./utils/is-defined');

var IpfsNotDefinedError = function IpfsNotDefinedError() {
  return new Error('Ipfs instance not defined');
};

var Entry = function () {
  function Entry() {
    (0, _classCallCheck3.default)(this, Entry);
  }

  (0, _createClass3.default)(Entry, null, [{
    key: 'create',

    /**
     * Create an Entry
     * @param {IPFS} ipfs - An IPFS instance
     * @param {string|Buffer|Object|Array} data - Data of the entry to be added. Can be any JSON.stringifyable data.
     * @param {Array<Entry|string>} [next=[]] Parents of the entry
     * @example
     * const entry = await Entry.create(ipfs, 'hello')
     * console.log(entry)
     * // { hash: "Qm...Foo", payload: "hello", next: [] }
     * @returns {Promise<Entry>}
     */
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(ipfs, acl, id, data) {
        var next = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [];
        var clock = arguments[5];
        var toEntry, nexts, clockId, clockTime, entry;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (isDefined(ipfs)) {
                  _context.next = 2;
                  break;
                }

                throw IpfsNotDefinedError();

              case 2:
                if (isDefined(id)) {
                  _context.next = 4;
                  break;
                }

                throw new Error('Entry requires an id');

              case 4:
                if (isDefined(data)) {
                  _context.next = 6;
                  break;
                }

                throw new Error('Entry requires data');

              case 6:
                if (!(!isDefined(next) || !Array.isArray(next))) {
                  _context.next = 8;
                  break;
                }

                throw new Error("'next' argument is not an array");

              case 8:

                // Clean the next objects and convert to hashes
                toEntry = function toEntry(e) {
                  return e.hash ? e.hash : e;
                };

                nexts = next.filter(isDefined).map(toEntry

                // Take the id of the given clock by default,
                // if clock not given, take the signing key if it's a Key instance,
                // or if none given, take the id as the clock id
                );
                clockId = clock ? clock.id : acl ? acl.getPublicSigningKey('hex') : id;
                clockTime = clock ? clock.time : null;
                entry = {
                  hash: null, // "Qm...Foo", we'll set the hash after persisting the entry
                  id: id, // For determining a unique chain
                  payload: data, // Can be any JSON.stringifyable data
                  next: nexts, // Array of Multihashes
                  v: 0, // For future data structure updates, should currently always be 0
                  clock: new Clock(clockId, clockTime)

                  // If acl was passed, sign the entry (=authorize)
                };

                if (!acl) {
                  _context.next = 17;
                  break;
                }

                _context.next = 16;
                return Entry.sign(entry, acl);

              case 16:
                entry = _context.sent;

              case 17:
                _context.next = 19;
                return Entry.toMultihash(ipfs, entry);

              case 19:
                entry.hash = _context.sent;
                return _context.abrupt('return', entry);

              case 21:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function create(_x2, _x3, _x4, _x5) {
        return _ref.apply(this, arguments);
      }

      return create;
    }()
  }, {
    key: 'sign',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(entry, acl) {
        var signature;
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return acl.sign(entry);

              case 2:
                signature = _context2.sent;

                entry.sig = signature;
                entry.key = acl.getPublicSigningKey('hex');
                return _context2.abrupt('return', entry);

              case 6:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function sign(_x6, _x7) {
        return _ref2.apply(this, arguments);
      }

      return sign;
    }()
  }, {
    key: 'verify',
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(entry, acl) {
        var e;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (entry.key) {
                  _context3.next = 2;
                  break;
                }

                throw new Error("Entry doesn't have a public key");

              case 2:
                if (entry.sig) {
                  _context3.next = 4;
                  break;
                }

                throw new Error("Entry doesn't have a signature");

              case 4:
                if (acl.canAppend(entry.key)) {
                  _context3.next = 6;
                  break;
                }

                throw new Error("Input log contains entries that are not allowed in this log");

              case 6:
                e = (0, _assign2.default)({}, {
                  hash: null,
                  id: entry.id,
                  payload: entry.payload,
                  next: entry.next,
                  v: entry.v,
                  clock: entry.clock
                }

                // Throws an error if verification fails
                );
                _context3.next = 9;
                return acl.verify(entry.key, entry.sig, e);

              case 9:
                return _context3.abrupt('return', _context3.sent);

              case 10:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function verify(_x8, _x9) {
        return _ref3.apply(this, arguments);
      }

      return verify;
    }()

    /**
     * Get the multihash of an Entry
     * @param {IPFS} [ipfs] An IPFS instance
     * @param {Entry} [entry] Entry to get a multihash for
     * @example
     * const hash = await Entry.toMultihash(ipfs, entry)
     * console.log(hash)
     * // "Qm...Foo"
     * @returns {Promise<string>}
     */

  }, {
    key: 'toMultihash',
    value: function toMultihash(ipfs, entry) {
      if (!ipfs) throw IpfsNotDefinedError();
      var data = Buffer.from((0, _stringify2.default)(entry));
      return ipfs.object.put(data).then(function (res) {
        return res.toJSON().multihash;
      });
    }

    /**
     * Create an Entry from a multihash
     * @param {IPFS} [ipfs] An IPFS instance
     * @param {string} [hash] Multihash as Base58 encoded string to create an Entry from
     * @example
     * const hash = await Entry.fromMultihash(ipfs, "Qm...Foo")
     * console.log(hash)
     * // { hash: "Qm...Foo", payload: "hello", next: [] }
     * @returns {Promise<Entry>}
     */

  }, {
    key: 'fromMultihash',
    value: function fromMultihash(ipfs, hash) {
      if (!ipfs) throw IpfsNotDefinedError();
      if (!hash) throw new Error('Invalid hash: ' + hash);
      return ipfs.object.get(hash, { enc: 'base58' }).then(function (obj) {
        return JSON.parse(obj.toJSON().data);
      }).then(function (data) {
        var entry = {
          hash: hash,
          id: data.id,
          payload: data.payload,
          next: data.next,
          v: data.v,
          clock: data.clock
        };
        if (data.sig) (0, _assign2.default)(entry, { sig: data.sig });
        if (data.key) (0, _assign2.default)(entry, { key: data.key });
        return entry;
      });
    }

    /**
     * Check if an object is an Entry
     * @param {Entry} obj
     * @returns {boolean}
     */

  }, {
    key: 'isEntry',
    value: function isEntry(obj) {
      return obj.id !== undefined && obj.next !== undefined && obj.hash !== undefined && obj.payload !== undefined && obj.v !== undefined && obj.clock !== undefined;
    }
  }, {
    key: 'compare',
    value: function compare(a, b) {
      var distance = Clock.compare(a.clock, b.clock);
      if (distance === 0) return a.clock.id < b.clock.id ? -1 : 1;
      return distance;
    }

    /**
     * Check if an entry equals another entry
     * @param {Entry} a
     * @param {Entry} b
     * @returns {boolean}
     */

  }, {
    key: 'isEqual',
    value: function isEqual(a, b) {
      return a.hash === b.hash;
    }

    /**
     * Check if an entry is a parent to another entry.
     * @param {Entry} [entry1] Entry to check
     * @param {Entry} [entry2] Parent
     * @returns {boolean}
     */

  }, {
    key: 'isParent',
    value: function isParent(entry1, entry2) {
      return entry2.next.indexOf(entry1.hash) > -1;
    }

    /**
     * Find entry's children from an Array of entries
     *
     * @description
     * Returns entry's children as an Array up to the last know child.
     *
     * @param {Entry} [entry] Entry for which to find the parents
     * @param {Array<Entry>} [vaules] Entries to search parents from
     * @returns {Array<Entry>}
     */

  }, {
    key: 'findChildren',
    value: function findChildren(entry, values) {
      var stack = [];
      var parent = values.find(function (e) {
        return Entry.isParent(entry, e);
      });
      var prev = entry;
      while (parent) {
        stack.push(parent);
        prev = parent;
        parent = values.find(function (e) {
          return Entry.isParent(prev, e);
        });
      }
      stack = stack.sort(function (a, b) {
        return a.clock.time > a.clock.time;
      });
      return stack;
    }
  }]);
  return Entry;
}();

module.exports = Entry;