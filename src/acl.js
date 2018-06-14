class ACL {
  constructor (keystore, key, keys = []) {
    this._keystore = keystore
    this._key = key
    this._keys = keys && Array.isArray(keys) ? keys : keys ? [keys] : []
  }

  getSigningKey () {
    return this._key
  }

  getPublicSigningKey (format = 'hex') {
    return this._key.getPublic(format)
  }

  canAppend (signingKey) {
    // If the ACL contains '*', allow append
    if (this._keys.includes('*'))
      return true

    // If the ACl contains the given key, allow
    if (this._keys.includes(signingKey))
      return true

    return false
  }

  async sign (data) {
    // Verify that we're allowed to write
    if (!this.canAppend(this.getPublicSigningKey('hex')))
      throw new Error("Not allowed to write")

    // TODO: this should not handle encoding!
    const signature = await this._keystore.sign(this._key, Buffer.from(JSON.stringify(data)))
    return signature
  }

  async verify (signingKey, signature, data) {
    // TODO: need to check against timestamp, ie. "was this key able to write at this time?"
    if (!this.canAppend(signingKey))
      throw new Error("Input log contains entries that are not allowed in this log")

    const pubKey = await this._keystore.importPublicKey(signingKey)
    try {
      // TODO: this should not handle encoding!
      await this._keystore.verify(signature, pubKey, Buffer.from(JSON.stringify(data)))
    } catch (e) {
      throw new Error(`Invalid signature '${signature}'`)
    }
  }
}

module.exports = ACL
