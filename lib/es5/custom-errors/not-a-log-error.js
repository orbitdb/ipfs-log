'use strict';

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var CustomError = require('./custom-error');

var DEFAULT_MESSAGE = 'Given argument is not an instance of Log';
var ERROR_CODE = 'not-a-log-error';

var NotALogError = function (_CustomError) {
  (0, _inherits3.default)(NotALogError, _CustomError);

  function NotALogError() {
    var msg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DEFAULT_MESSAGE;
    var details = arguments[1];
    (0, _classCallCheck3.default)(this, NotALogError);
    return (0, _possibleConstructorReturn3.default)(this, (NotALogError.__proto__ || (0, _getPrototypeOf2.default)(NotALogError)).call(this, ERROR_CODE, msg, details));
  }

  return NotALogError;
}(CustomError);

module.exports = NotALogError;