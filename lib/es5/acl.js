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

var ACL = function () {
  function ACL(checkPermission) {
    (0, _classCallCheck3.default)(this, ACL);

    if (!isFunction(checkPermission)) {
      throw new Error('Permission verification function is invalid');
    }

    this._checkPermission = checkPermission;
  }

  (0, _createClass3.default)(ACL, [{
    key: 'canAppend',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)( /*#__PURE__*/_regenerator2.default.mark(function _callee(key, entry) {
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (key) {
                  _context.next = 2;
                  break;
                }

                throw new Error("A key is required to check for permission");

              case 2:
                if (entry.sig) {
                  _context.next = 4;
                  break;
                }

                throw new Error("Entry doesn't have a signature");

              case 4:
                if (entry.key) {
                  _context.next = 6;
                  break;
                }

                throw new Error("Entry doesn't have a public key");

              case 6:
                return _context.abrupt('return', this._checkPermission(key, entry));

              case 7:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function canAppend(_x, _x2) {
        return _ref.apply(this, arguments);
      }

      return canAppend;
    }()
  }]);
  return ACL;
}();

module.exports = ACL;