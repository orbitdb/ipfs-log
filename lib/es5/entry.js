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

var _require = require('./utils'),
    isDefined = _require.isDefined;

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
     * @param {string|Buffer|Object|Array} data - Data of the entry to be added. Can be any JSON.stringifyable data.
     * @param {Array<Entry|string>} [next=[]] Parents of the entry
     * @example
     * const entry = await Entry.create(ipfs, identity, 'hello')
     * console.log(entry)
     * // { hash: null, payload: "hello", next: [] }
     * @returns {Promise<Entry>}
     */
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(ipfs, identity, logId, data) {
        var next = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [];
        var clock = arguments[5];
        var toEntry, nexts, entry, signature;
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
                if (isDefined(identity)) {
                  _context.next = 4;
                  break;
                }

                throw new Error('Identity is required, cannot create entry');

              case 4:
                if (isDefined(logId)) {
                  _context.next = 6;
                  break;
                }

                throw new Error('Entry requires an id');

              case 6:
                if (isDefined(data)) {
                  _context.next = 8;
                  break;
                }

                throw new Error('Entry requires data');

              case 8:
                if (!(!isDefined(next) || !Array.isArray(next))) {
                  _context.next = 10;
                  break;
                }

                throw new Error("'next' argument is not an array");

              case 10:

                // Clean the next objects and convert to hashes
                toEntry = function toEntry(e) {
                  return e.hash ? e.hash : e;
                };

                nexts = next.filter(isDefined).map(toEntry);
                entry = {
                  hash: null, // "Qm...Foo", we'll set the hash after persisting the entry
                  id: logId, // For determining a unique chain
                  payload: data, // Can be any JSON.stringifyable data
                  next: nexts, // Array of Multihashes
                  v: 0, // For future data structure updates, should currently always be 0
                  clock: clock || new Clock(identity.publicKey)
                };
                _context.next = 15;
                return identity.provider.sign(identity, Entry.toBuffer(entry));

              case 15:
                signature = _context.sent;

                entry.key = identity.publicKey;
                entry.identity = identity.toJSON();
                entry.sig = signature;
                _context.next = 21;
                return Entry.toMultihash(ipfs, entry);

              case 21:
                entry.hash = _context.sent;
                return _context.abrupt('return', entry);

              case 23:
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

    /**
     * Verifies an entry signature for a given key and sig
     * @param  {Entry}  entry Entry to verify
     * @return {Promise}      Returns a promise that resolves to a boolean value
     * indicating if the entry signature is valid
     */

  }, {
    key: 'verify',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(identityProvider, entry) {
        var e;
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                if (identityProvider) {
                  _context2.next = 2;
                  break;
                }

                throw new Error('Identity-provider is required, cannot verify entry');

              case 2:
                if (Entry.isEntry(entry)) {
                  _context2.next = 4;
                  break;
                }

                throw new Error('Invalid Log entry');

              case 4:
                if (entry.key) {
                  _context2.next = 6;
                  break;
                }

                throw new Error("Entry doesn't have a key");

              case 6:
                if (entry.sig) {
                  _context2.next = 8;
                  break;
                }

                throw new Error("Entry doesn't have a signature");

              case 8:
                e = (0, _assign2.default)({}, {
                  hash: null,
                  id: entry.id,
                  payload: entry.payload,
                  next: entry.next,
                  v: entry.v,
                  clock: new Clock(entry.clock.id, entry.clock.time)
                });
                return _context2.abrupt('return', identityProvider.verify(entry.sig, entry.key, Entry.toBuffer(e)));

              case 10:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function verify(_x6, _x7) {
        return _ref2.apply(this, arguments);
      }

      return verify;
    }()
  }, {
    key: 'toBuffer',
    value: function toBuffer(entry) {
      return Buffer.from((0, _stringify2.default)(entry));
    }

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
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee3(ipfs, entry) {
        var isValidEntryObject, e, data, object;
        return _regenerator2.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (ipfs) {
                  _context3.next = 2;
                  break;
                }

                throw IpfsNotDefinedError();

              case 2:
                isValidEntryObject = function isValidEntryObject(entry) {
                  return entry.id && entry.clock && entry.next && entry.payload && entry.v >= 0;
                };

                if (isValidEntryObject(entry)) {
                  _context3.next = 5;
                  break;
                }

                throw new Error('Invalid object format, cannot generate entry multihash');

              case 5:

                // Ensure `entry` follows the correct format
                e = {
                  hash: null,
                  id: entry.id,
                  payload: entry.payload,
                  next: entry.next,
                  v: entry.v,
                  clock: entry.clock
                };


                if (entry.key) (0, _assign2.default)(e, { key: entry.key });
                if (entry.identity) (0, _assign2.default)(e, { identity: entry.identity });
                if (entry.sig) (0, _assign2.default)(e, { sig: entry.sig });

                data = Entry.toBuffer(e);
                _context3.next = 12;
                return ipfs.object.put(data);

              case 12:
                object = _context3.sent;
                return _context3.abrupt('return', object.toJSON().multihash);

              case 14:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function toMultihash(_x8, _x9) {
        return _ref3.apply(this, arguments);
      }

      return toMultihash;
    }()

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
    value: function () {
      var _ref4 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee4(ipfs, hash) {
        var obj, data, entry;
        return _regenerator2.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (ipfs) {
                  _context4.next = 2;
                  break;
                }

                throw IpfsNotDefinedError();

              case 2:
                if (hash) {
                  _context4.next = 4;
                  break;
                }

                throw new Error('Invalid hash: ' + hash);

              case 4:
                _context4.next = 6;
                return ipfs.object.get(hash, { enc: 'base58' });

              case 6:
                obj = _context4.sent;
                data = JSON.parse(obj.toJSON().data);
                entry = {
                  hash: hash,
                  id: data.id,
                  payload: data.payload,
                  next: data.next,
                  v: data.v,
                  clock: new Clock(data.clock.id, data.clock.time)
                };


                if (data.key) (0, _assign2.default)(entry, { key: data.key });
                if (data.identity) (0, _assign2.default)(entry, { identity: data.identity });
                if (data.sig) (0, _assign2.default)(entry, { sig: data.sig });

                return _context4.abrupt('return', entry);

              case 13:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function fromMultihash(_x10, _x11) {
        return _ref4.apply(this, arguments);
      }

      return fromMultihash;
    }()

    /**
     * Check if an object is an Entry
     * @param {Entry} obj
     * @returns {boolean}
     */

  }, {
    key: 'isEntry',
    value: function isEntry(obj) {
      return obj && obj.id !== undefined && obj.next !== undefined && obj.hash !== undefined && obj.payload !== undefined && obj.v !== undefined && obj.clock !== undefined;
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
        return a.clock.time > b.clock.time;
      });
      return stack;
    }
  }]);
  return Entry;
}();

module.exports = Entry;