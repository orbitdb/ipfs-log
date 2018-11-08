'use strict';

var difference = require('./difference');
var findUniques = require('./find-uniques');
var intersection = require('./intersection');
var isDefined = require('./is-defined');

module.exports = {
  difference: difference,
  findUniques: findUniques,
  intersection: intersection,
  isDefined: isDefined
};