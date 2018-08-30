'use strict'

class AccessController {
  async canAppend (entry, identityProvider) {
    return true
  }
}

module.exports = AccessController
