const CustomError = require('./custom-error');

const DEFAULT_MESSAGE = 'Log instance not defined'
const ERROR_CODE = 'log-instance-not-defined-error'

class LogNotDefinedError extends CustomError {
  constructor(msg = DEFAULT_MESSAGE, details) {
    super(ERROR_CODE, msg, details)
  }
}

module.exports = LogNotDefinedError
