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

var DEFAULT_MESSAGE = 'Log instance not defined';
var ERROR_CODE = 'log-instance-not-defined-error';

var LogNotDefinedError = function (_CustomError) {
  (0, _inherits3.default)(LogNotDefinedError, _CustomError);

  function LogNotDefinedError() {
    var msg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DEFAULT_MESSAGE;
    var details = arguments[1];
    (0, _classCallCheck3.default)(this, LogNotDefinedError);
    return (0, _possibleConstructorReturn3.default)(this, (LogNotDefinedError.__proto__ || (0, _getPrototypeOf2.default)(LogNotDefinedError)).call(this, ERROR_CODE, msg, details));
  }

  return LogNotDefinedError;
}(CustomError);

module.exports = LogNotDefinedError;