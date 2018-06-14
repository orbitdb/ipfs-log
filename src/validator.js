
const isFunction = require('./utils/is-function')
const encode = data => Buffer.from(JSON.stringify(data))

class EntryValidator {
  constructor (sign, verifySignature, publicKey) {
    if (!isFunction(sign)) {
      throw new Error('Signing function is invalid')
    }

    if (!isFunction(verifySignature)) {
      throw new Error('Signature verification function is invalid')
    }

    if (!publicKey) {
      throw new Error('Invalid public key')
    }

    this._sign = sign
    this._verifySignature = verifySignature
    this._publicKey = publicKey
  }

  get publicKey () {
    return this._publicKey
  }

  async signEntry (entry) {
    try {
      return this._sign(entry, encode(entry))
    } catch(error) {
      throw new Error('Could not sign entry')
    }
  }

  async verifyEntrySignature (key, signature, entry) {
    try {
      return this._verifySignature(entry, signature, key, encode(entry))
    } catch (error) {
      throw new Error(`Could not validate signature: ${signature}`)
    }
  }
}

module.exports = EntryValidator
