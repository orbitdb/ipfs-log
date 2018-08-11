'use strict';

var isFunction = function isFunction(fn) {
  return fn && fn.call && fn.apply && typeof fn === 'function';
};

module.exports = isFunction;