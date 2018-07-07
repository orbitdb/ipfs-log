'use strict';

var IpfsNotDefinedError = require('./ipfs-not-defined-error');
var NotALogError = require('./not-a-log-error');
var LogNotDefinedError = require('./log-not-defined-error');

module.exports = {
  IpfsNotDefinedError: IpfsNotDefinedError,
  NotALogError: NotALogError,
  LogNotDefinedError: LogNotDefinedError
};
