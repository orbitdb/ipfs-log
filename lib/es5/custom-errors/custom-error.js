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

var ErrorSubclass = require('error-subclass').default;

var CustomError = function (_ErrorSubclass) {
  (0, _inherits3.default)(CustomError, _ErrorSubclass);

  function CustomError(code, msg) {
    var details = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
    (0, _classCallCheck3.default)(this, CustomError);

    var _this = (0, _possibleConstructorReturn3.default)(this, (CustomError.__proto__ || (0, _getPrototypeOf2.default)(CustomError)).call(this, msg));

    _this.code = code;
    _this.details = details;
    return _this;
  }

  return CustomError;
}(ErrorSubclass);

module.exports = CustomError;