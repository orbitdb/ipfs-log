'use strict';

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _defineProperty2 = _interopRequireDefault(require("@babel/runtime/helpers/defineProperty"));

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var Clock = require('./lamport-clock');

var _require = require('./utils'),
    isDefined = _require.isDefined,
    io = _require.io;

var IPLD_LINKS = ['next'];

var IpfsNotDefinedError = function IpfsNotDefinedError() {
  return new Error('Ipfs instance not defined');
};

var getCidProp = function getCidProp(entry) {
  return entry.v === 0 ? 'hash' : 'cid';
};

var Entry =
/*#__PURE__*/
function () {
  function Entry() {
    (0, _classCallCheck2.default)(this, Entry);
  }

  (0, _createClass2.default)(Entry, null, [{
    key: "create",

    /**
     * Create an Entry
     * @param {IPFS} ipfs An IPFS instance
     * @param {Identity} identity The identity instance
     * @param {string} logId The unique identifier for this log
     * @param {*} data Data of the entry to be added. Can be any JSON.stringifyable data
     * @param {Array<string|Entry>} [next=[]] Parent CIDs or entries
     * @param {LamportClock} [clock] The lamport clock
     * @returns {Promise<Entry>}
     * @example
     * const entry = await Entry.create(ipfs, identity, 'hello')
     * console.log(entry)
     * // { cid: null, payload: "hello", next: [] }
     */
    value: function () {
      var _create = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee(ipfs, identity, logId, data) {
        var next,
            clock,
            toEntry,
            nexts,
            entry,
            signature,
            _args = arguments;
        return _regenerator.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                next = _args.length > 4 && _args[4] !== undefined ? _args[4] : [];
                clock = _args.length > 5 ? _args[5] : undefined;

                if (isDefined(ipfs)) {
                  _context.next = 4;
                  break;
                }

                throw IpfsNotDefinedError();

              case 4:
                if (isDefined(identity)) {
                  _context.next = 6;
                  break;
                }

                throw new Error('Identity is required, cannot create entry');

              case 6:
                if (isDefined(logId)) {
                  _context.next = 8;
                  break;
                }

                throw new Error('Entry requires an id');

              case 8:
                if (isDefined(data)) {
                  _context.next = 10;
                  break;
                }

                throw new Error('Entry requires data');

              case 10:
                if (!(!isDefined(next) || !Array.isArray(next))) {
                  _context.next = 12;
                  break;
                }

                throw new Error("'next' argument is not an array");

              case 12:
                // Clean the next objects and convert to cids
                toEntry = function toEntry(e) {
                  return e.cid ? e.cid : e;
                };

                nexts = next.filter(isDefined).map(toEntry);
                entry = {
                  cid: null,
                  // "zd...Foo", we'll set the cid after persisting the entry
                  id: logId,
                  // For determining a unique chain
                  payload: data,
                  // Can be any JSON.stringifyable data
                  next: nexts,
                  // Array of CIDs
                  v: 1,
                  // To tag the version of this data structure
                  clock: clock || new Clock(identity.publicKey)
                };
                _context.next = 17;
                return identity.provider.sign(identity, Entry.toBuffer(entry));

              case 17:
                signature = _context.sent;
                entry.key = identity.publicKey;
                entry.identity = identity.toJSON();
                entry.sig = signature;
                _context.next = 23;
                return Entry.toCID(ipfs, entry);

              case 23:
                entry.cid = _context.sent;
                return _context.abrupt("return", Entry.ensureInterop(entry));

              case 25:
              case "end":
                return _context.stop();
            }
          }
        }, _callee);
      }));

      function create(_x, _x2, _x3, _x4) {
        return _create.apply(this, arguments);
      }

      return create;
    }()
    /**
     * Verifies an entry signature.
     *
     * @param {IdentityProvider} identityProvider The identity provider to use
     * @param {Entry} entry The entry being verified
     * @return {Promise} A promise that resolves to a boolean value indicating if the signature is valid
     */

  }, {
    key: "verify",
    value: function () {
      var _verify = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee2(identityProvider, entry) {
        var _e;

        var e;
        return _regenerator.default.wrap(function _callee2$(_context2) {
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
                e = (_e = {}, (0, _defineProperty2.default)(_e, getCidProp(entry), null), (0, _defineProperty2.default)(_e, "id", entry.id), (0, _defineProperty2.default)(_e, "payload", entry.payload), (0, _defineProperty2.default)(_e, "next", entry.next), (0, _defineProperty2.default)(_e, "v", entry.v), (0, _defineProperty2.default)(_e, "clock", entry.clock), _e);
                return _context2.abrupt("return", identityProvider.verify(entry.sig, entry.key, Entry.toBuffer(e)));

              case 10:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2);
      }));

      function verify(_x5, _x6) {
        return _verify.apply(this, arguments);
      }

      return verify;
    }()
    /**
     * Transforms an entry into a Buffer.
     * @param {Entry} entry The entry
     * @return {Buffer} The buffer
     */

  }, {
    key: "toBuffer",
    value: function toBuffer(entry) {
      return Buffer.from(JSON.stringify(entry));
    }
    /**
     * Get the CID of an Entry.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Entry} entry Entry to get a CID for
     * @returns {Promise<string>}
     * @example
     * const cid = await Entry.toCID(ipfs, entry)
     * console.log(cid)
     * // "zd...Foo"
     */

  }, {
    key: "toCID",
    value: function toCID(ipfs, entry) {
      if (!ipfs) throw IpfsNotDefinedError();
      if (!Entry.isEntry(entry)) throw new Error('Invalid object format, cannot generate entry CID'); // Ensure `entry` follows the correct format

      var e = {
        cid: null,
        id: entry.id,
        payload: entry.payload,
        next: entry.next,
        v: entry.v,
        clock: entry.clock
      };
      if (entry.key) Object.assign(e, {
        key: entry.key
      });
      if (entry.identity) Object.assign(e, {
        identity: entry.identity
      });
      if (entry.sig) Object.assign(e, {
        sig: entry.sig
      });
      return io.write(ipfs, 'dag-cbor', e, {
        links: IPLD_LINKS
      });
    }
    /**
     * Get the multihash of an Entry.
     * @param {IPFS} ipfs An IPFS instance
     * @param {Entry} entry Entry to get a multihash for
     * @returns {Promise<string>}
     * @example
     * const multihash = await Entry.toMultihash(ipfs, entry)
     * console.log(multihash)
     * // "Qm...Foo"
     * @deprecated
     */

  }, {
    key: "toMultihash",
    value: function () {
      var _toMultihash = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee3(ipfs, entry) {
        var e;
        return _regenerator.default.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                if (ipfs) {
                  _context3.next = 2;
                  break;
                }

                throw IpfsNotDefinedError();

              case 2:
                if (Entry.isEntry(entry)) {
                  _context3.next = 4;
                  break;
                }

                throw new Error('Invalid object format, cannot generate entry CID');

              case 4:
                // Ensure `entry` follows the correct format
                e = {
                  hash: null,
                  id: entry.id,
                  payload: entry.payload,
                  next: entry.next,
                  v: 0,
                  clock: entry.clock
                };
                if (entry.key) Object.assign(e, {
                  key: entry.key
                });
                if (entry.identity) Object.assign(e, {
                  identity: entry.identity
                });
                if (entry.sig) Object.assign(e, {
                  sig: entry.sig
                });
                return _context3.abrupt("return", io.write(ipfs, 'dag-pb', e, {
                  links: IPLD_LINKS
                }));

              case 9:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3);
      }));

      function toMultihash(_x7, _x8) {
        return _toMultihash.apply(this, arguments);
      }

      return toMultihash;
    }()
    /**
     * Create an Entry from a CID.
     * @param {IPFS} ipfs An IPFS instance
     * @param {string} cid The CID to create an Entry from
     * @returns {Promise<Entry>}
     * @example
     * const entry = await Entry.fromCID(ipfs, "zd...Foo")
     * console.log(entry)
     * // { cid: "Zd...Foo", payload: "hello", next: [] }
     */

  }, {
    key: "fromCID",
    value: function () {
      var _fromCID = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee4(ipfs, cid) {
        var _entry;

        var e, entry;
        return _regenerator.default.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                if (ipfs) {
                  _context4.next = 2;
                  break;
                }

                throw IpfsNotDefinedError();

              case 2:
                if (cid) {
                  _context4.next = 4;
                  break;
                }

                throw new Error("Invalid CID: ".concat(cid));

              case 4:
                _context4.next = 6;
                return io.read(ipfs, cid, {
                  links: IPLD_LINKS
                });

              case 6:
                e = _context4.sent;
                entry = (_entry = {}, (0, _defineProperty2.default)(_entry, getCidProp(e), cid), (0, _defineProperty2.default)(_entry, "id", e.id), (0, _defineProperty2.default)(_entry, "payload", e.payload), (0, _defineProperty2.default)(_entry, "next", e.next), (0, _defineProperty2.default)(_entry, "v", e.v), (0, _defineProperty2.default)(_entry, "clock", new Clock(e.clock.id, e.clock.time)), _entry);
                if (e.key) Object.assign(entry, {
                  key: e.key
                });
                if (e.identity) Object.assign(entry, {
                  identity: e.identity
                });
                if (e.sig) Object.assign(entry, {
                  sig: e.sig
                });
                return _context4.abrupt("return", Entry.ensureInterop(entry));

              case 12:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4);
      }));

      function fromCID(_x9, _x10) {
        return _fromCID.apply(this, arguments);
      }

      return fromCID;
    }()
    /**
     * Create an Entry from a multihash.
     * @param {IPFS} ipfs An IPFS instance
     * @param {string} multihash Multihash (as a Base58 encoded string) to create the Entry from
     * @returns {Promise<Entry>}
     * @example
     * const entry = await Entry.fromMultihash(ipfs, "Qm...Foo")
     * console.log(entry)
     * // { cid: "Qm...Foo", payload: "hello", next: [] }
     * @deprecated
     */

  }, {
    key: "fromMultihash",
    value: function () {
      var _fromMultihash = (0, _asyncToGenerator2.default)(
      /*#__PURE__*/
      _regenerator.default.mark(function _callee5(ipfs, multihash) {
        return _regenerator.default.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                return _context5.abrupt("return", Entry.fromCID(ipfs, multihash));

              case 1:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5);
      }));

      function fromMultihash(_x11, _x12) {
        return _fromMultihash.apply(this, arguments);
      }

      return fromMultihash;
    }()
    /**
     * Check if an object is an Entry.
     * @param {Entry} obj
     * @returns {boolean}
     */

  }, {
    key: "isEntry",
    value: function isEntry(obj) {
      return obj && obj.id !== undefined && obj.next !== undefined && obj.payload !== undefined && obj.v !== undefined && obj[getCidProp(obj)] !== undefined && obj.clock !== undefined;
    }
    /**
     * Ensures that this entry is interoperable between earlier versions
     * and the most recent one (and vice-versa).
     * @param {Entry} entry The entry to ensure interoperability
     * @return {Entry} entry The same entry but with backwards and forward interoperability
     */

  }, {
    key: "ensureInterop",
    value: function ensureInterop(entry) {
      if (entry.cid && entry.hash) {
        return entry;
      }

      var prop = getCidProp(entry);
      var accessorProp = prop === 'hash' ? 'cid' : 'hash';
      Object.defineProperty(entry, accessorProp, {
        get: function get() {
          return this[prop];
        },
        set: function set(value) {
          this[prop] = value;
        }
      });
      return entry;
    }
    /**
     * Compares two entries.
     * @param {Entry} a
     * @param {Entry} b
     * @returns {number} 1 if a is greater, -1 is b is greater
     */

  }, {
    key: "compare",
    value: function compare(a, b) {
      var distance = Clock.compare(a.clock, b.clock);
      if (distance === 0) return a.clock.id < b.clock.id ? -1 : 1;
      return distance;
    }
    /**
     * Check if an entry equals another entry.
     * @param {Entry} a
     * @param {Entry} b
     * @returns {boolean}
     */

  }, {
    key: "isEqual",
    value: function isEqual(a, b) {
      return a.cid === b.cid;
    }
    /**
     * Check if an entry is a parent to another entry.
     * @param {Entry} entry1 Entry to check
     * @param {Entry} entry2 The parent Entry
     * @returns {boolean}
     */

  }, {
    key: "isParent",
    value: function isParent(entry1, entry2) {
      return entry2.next.indexOf(entry1.cid) > -1;
    }
    /**
     * Find entry's children from an Array of entries.
     * Returns entry's children as an Array up to the last know child.
     * @param {Entry} entry Entry for which to find the parents
     * @param {Array<Entry>} values Entries to search parents from
     * @returns {Array<Entry>}
     */

  }, {
    key: "findChildren",
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