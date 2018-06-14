const pMap = require('p-map')

class DefaultACL {
  constructor (keystore, key, keys = []) {
    this._keystore = keystore
    this._key = key
    this._keys = Array.isArray(keys) ? keys : [keys]
    this._verifiers = []
  }

  getPublicSigningKey () {
    return this._key
  }

  getSigningKey () {
    return this._key
  }

  addVerifier (fn) {
    this._verifiers.push(fn)
  }

  canAppend (signingKey, timestamp) {
    return true
  }

  async sign (data) {
    // Verify that we're allowed to write
    if (!this.canAppend(this.getPublicSigningKey('hex')))
      throw new Error("Not allowed to write")

    return "-"
  }

  async verify (signingKey, signature, data) {
    // TODO: need to check against timestamp, ie. "was this key able to write at this time?"
    if (!this.canAppend(signingKey))
      throw new Error("Input log contains entries that are not allowed in this log")

    const verify = async (f) => await f(signingKey, signature, data)
    const verifications = await pMap(this._verifiers, verify)
    const verified = this._verifiers.length == 0 ? true : verifications.every(e => e === true)

    if (!verified)
      throw new Error(`Couldn't verify '${data}'`)

    return true
  }
}

module.exports = DefaultACL