'use strict';

var difference = require('./difference');
var findUniques = require('./find-uniques');
var intersection = require('./intersection');
var isDefined = require('./is-defined');
var isFunction = require('./is-function');

module.exports = {
  difference: difference,
  findUniques: findUniques,
  intersection: intersection,
  isFunction: isFunction,
  isDefined: isDefined
};