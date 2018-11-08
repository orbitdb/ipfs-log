'use strict';

var IPFSNotDefinedError = function IPFSNotDefinedError() {
  return new Error('IPFS instance not defined');
};
var LogNotDefinedError = function LogNotDefinedError() {
  return new Error('Log instance not defined');
};
var NotALogError = function NotALogError() {
  return new Error('Given argument is not an instance of Log');
};

module.exports = {
  IPFSNotDefinedError: IPFSNotDefinedError,
  LogNotDefinedError: LogNotDefinedError,
  NotALogError: NotALogError
};