'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _stringify = require('babel-runtime/core-js/json/stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var ACL = function () {
  function ACL(keystore, key) {
    var keys = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
    (0, _classCallCheck3.default)(this, ACL);

    this._keystore = keystore;
    this._key = key;
    this._keys = keys && Array.isArray(keys) ? keys : keys ? [keys] : [];
  }

  (0, _createClass3.default)(ACL, [{
    key: 'getSigningKey',
    value: function getSigningKey() {
      return this._key;
    }
  }, {
    key: 'getPublicSigningKey',
    value: function getPublicSigningKey() {
      var format = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'hex';

      return this._key.getPublic(format);
    }
  }, {
    key: 'canAppend',
    value: function canAppend(signingKey) {
      // If the ACL contains '*', allow append
      if (this._keys.includes('*')) return true;

      // If the ACl contains the given key, allow
      if (this._keys.includes(signingKey)) return true;

      return false;
    }
  }, {
    key: 'sign',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(data) {
        var signature;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (this.canAppend(this.getPublicSigningKey('hex'))) {
                  _context.next = 2;
                  break;
                }

                throw new Error("Not allowed to write");

              case 2:
                _context.next = 4;
                return this._keystore.sign(this._key, Buffer.from((0, _stringify2.default)(data)));

              case 4:
                signature = _context.sent;
                return _context.abrupt('return', signature);

              case 6:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function sign(_x3) {
        return _ref.apply(this, arguments);
      }

      return sign;
    }()
  }, {
    key: 'verify',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(signingKey, signature, data) {
        var pubKey;
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.next = 2;
                return this._keystore.importPublicKey(signingKey);

              case 2:
                pubKey = _context2.sent;
                _context2.prev = 3;
                _context2.next = 6;
                return this._keystore.verify(signature, pubKey, Buffer.from((0, _stringify2.default)(data)));

              case 6:
                _context2.next = 11;
                break;

              case 8:
                _context2.prev = 8;
                _context2.t0 = _context2['catch'](3);
                throw new Error('Invalid signature \'' + signature + '\'');

              case 11:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this, [[3, 8]]);
      }));

      function verify(_x4, _x5, _x6) {
        return _ref2.apply(this, arguments);
      }

      return verify;
    }()
  }]);
  return ACL;
}();

module.exports = ACL;