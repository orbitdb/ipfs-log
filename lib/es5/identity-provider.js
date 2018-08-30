'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isFunction = require('./utils/is-function');

var IdentityProvider = function () {
  function IdentityProvider(sign, verify) {
    (0, _classCallCheck3.default)(this, IdentityProvider);

    if (!isFunction(sign)) {
      throw new Error('Signing function is invalid');
    }

    if (!isFunction(verify)) {
      throw new Error('Signature verification function is invalid');
    }

    this._sign = sign;
    this._verify = verify;
  }

  (0, _createClass3.default)(IdentityProvider, [{
    key: 'sign',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(data) {
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.prev = 0;
                return _context.abrupt('return', this._sign(data));

              case 4:
                _context.prev = 4;
                _context.t0 = _context['catch'](0);

                console.error(_context.t0);
                throw new Error('Could not sign entry');

              case 8:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this, [[0, 4]]);
      }));

      function sign(_x) {
        return _ref.apply(this, arguments);
      }

      return sign;
    }()
  }, {
    key: 'verify',
    value: function () {
      var _ref2 = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee2(signature, key, data) {
        return _regenerator2.default.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                _context2.prev = 0;
                return _context2.abrupt('return', this._verify(signature, key, data));

              case 4:
                _context2.prev = 4;
                _context2.t0 = _context2['catch'](0);

                console.error(_context2.t0);
                throw new Error('Could not validate signature');

              case 8:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this, [[0, 4]]);
      }));

      function verify(_x2, _x3, _x4) {
        return _ref2.apply(this, arguments);
      }

      return verify;
    }()
  }]);
  return IdentityProvider;
}();

module.exports = IdentityProvider;