const CustomError = require('./custom-error');

const DEFAULT_MESSAGE = 'Ipfs instance not defined'
const ERROR_CODE = 'ipfs-not-defined-error'

class IpfsNotDefinedError extends CustomError {
  constructor(msg = DEFAULT_MESSAGE, details) {
    super(ERROR_CODE, msg, details)
  }
}

module.exports = IpfsNotDefinedError
