'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isFunction = require('./utils/is-function');
var encode = function encode(data) {
  return Buffer.from((0, _stringify2.default)(data));
};

var EntryValidator = function () {
  function EntryValidator() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        checkPermissionsAndSign = _ref.checkPermissionsAndSign,
        checkPermissionsAndVerifySignature = _ref.checkPermissionsAndVerifySignature,
        publicKey = _ref.publicKey;

    (0, _classCallCheck3.default)(this, EntryValidator);

    if (!isFunction(checkPermissionsAndSign)) {
      throw new Error('Signing function is invalid');
    }

    if (!isFunction(checkPermissionsAndVerifySignature)) {
      throw new Error('Signature verification function is invalid');
    }

    if (!publicKey) {
      throw new Error('Invalid public key');
    }

    this._checkPermissionsAndSign = checkPermissionsAndSign;
    this._checkPermissionsAndVerifySignature = checkPermissionsAndVerifySignature;
    this._publicKey = publicKey;
  }

  (0, _createClass3.default)(EntryValidator, [{
    key: 'signEntry',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(entry) {
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.prev = 0;
                return _context.abrupt('return', this._checkPermissionsAndSign(entry, encode(entry)));

              case 4:
                _context.prev = 4;
                _context.t0 = _context['catch'](0);

                console.error(_context.t0);
                throw new Error('Could not sign entry or key not allowed');

              case 8:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[0, 4]]);
      }));

      function signEntry(_x2) {
        return _ref2.apply(this, arguments);
      }

      return signEntry;
    }()
  }, {
    key: 'verifyEntrySignature',
    value: function () {
      var _ref3 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(entry) {
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.prev = 0;
                return _context2.abrupt('return', this._checkPermissionsAndVerifySignature(entry, encode(entry)));

              case 4:
                _context2.prev = 4;
                _context2.t0 = _context2['catch'](0);

                console.error(_context2.t0);
                throw new Error('Could not validate signature or key not allowed');

              case 8:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this, [[0, 4]]);
      }));

      function verifyEntrySignature(_x3) {
        return _ref3.apply(this, arguments);
      }

      return verifyEntrySignature;
    }()
  }, {
    key: 'publicKey',
    set: function set(key) {
      this._publicKey = key;
    },
    get: function get() {
      return this._publicKey;
    }
  }]);
  return EntryValidator;
}();

module.exports = EntryValidator;