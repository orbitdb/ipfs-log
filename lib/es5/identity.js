'use strict';

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var isFunction = require('./utils/is-function');

var Identity = function () {
  function Identity(id, publicKey, provider) {
    (0, _classCallCheck3.default)(this, Identity);

    if (!id) {
      throw new Error('Identity id is required');
    }

    if (!publicKey) {
      throw new Error('Invalid public key');
    }

    if (!provider) {
      throw new Error('Identity provider is required');
    }

    if (!provider.sign) {
      throw new Error('Identity provider signing function is required');
    }

    if (!isFunction(provider.sign)) {
      throw new Error('Identity provider signing function is invalid');
    }

    if (!provider.verify) {
      throw new Error('Identity provider signature verification function is required');
    }

    if (!isFunction(provider.verify)) {
      throw new Error('Identity provider signature verification function is invalid');
    }

    this._id = id;
    this._publicKey = publicKey;
    this._provider = provider;
  }

  /**
  * This is only used as a fallback to the clock id when necessary
  * @return {string} public key hex encoded
  */


  (0, _createClass3.default)(Identity, [{
    key: 'id',
    get: function get() {
      return this._id;
    }
  }, {
    key: 'publicKey',
    get: function get() {
      return this._publicKey;
    }
  }, {
    key: 'provider',
    get: function get() {
      return this._provider;
    }
  }]);
  return Identity;
}();

module.exports = Identity;