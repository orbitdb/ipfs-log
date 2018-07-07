'use strict'

const ErrorSubclass = require('error-subclass').default;

class CustomError extends ErrorSubclass {
  constructor(code, msg, details = {}) {
    super(msg)
    this.code = code
    this.details = details
  }
}

module.exports = CustomError
