const CustomError = require('./custom-error');

const DEFAULT_MESSAGE = 'Given argument is not an instance of Log'
const ERROR_CODE = 'not-a-log-error'

class NotALogError extends CustomError {
  constructor(msg = DEFAULT_MESSAGE, details) {
    super(ERROR_CODE, msg, details)
  }
}

module.exports = NotALogError
