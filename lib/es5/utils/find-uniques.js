'use strict';

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function findUniques(value, key) {
  // Create an index of the collection
  var uniques = {};
  var get = function get(e) {
    return uniques[e];
  };
  var addToIndex = function addToIndex(e) {
    return uniques[key ? e[key] : e] = e;
  };
  value.forEach(addToIndex);
  return (0, _keys2.default)(uniques).map(get);
}

module.exports = findUniques;