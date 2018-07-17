
const isFunction = require('./utils/is-function')
const encode = data => Buffer.from(JSON.stringify(data))

class EntryValidator {
  constructor ({ checkPermissionsAndSign, checkPermissionsAndVerifySignature, publicKey } = {}) {
    if (!isFunction(checkPermissionsAndSign)) {
      throw new Error('Signing function is invalid')
    }

    if (!isFunction(checkPermissionsAndVerifySignature)) {
      throw new Error('Signature verification function is invalid')
    }

    if (!publicKey) {
      throw new Error('Invalid public key')
    }

    this._checkPermissionsAndSign = checkPermissionsAndSign
    this._checkPermissionsAndVerifySignature = checkPermissionsAndVerifySignature
    this._publicKey = publicKey
  }

  set publicKey (key) {
    this._publicKey = key
  }

  get publicKey () {
    return this._publicKey
  }

  async signEntry (entry) {
    try {
      return this._checkPermissionsAndSign(entry, encode(entry))
    } catch(error) {
      console.error(error)
      throw new Error('Could not sign entry or key not allowed')
    }
  }

  async verifyEntrySignature (entry) {
    try {
      return this._checkPermissionsAndVerifySignature(entry, encode(entry))
    } catch (error) {
      console.error(error)
      throw new Error('Could not validate signature or key not allowed')
    }
  }
}

module.exports = EntryValidator
