
const DEFAULT_PUBLIC_KEY = 'key'
const DEFAULT_SIGNATURE = 'deadbeef'
const checkPermissionsAndSign =  () => DEFAULT_SIGNATURE
const checkPermissionsAndVerifySignature = entry => {
  if (entry.sig !== DEFAULT_SIGNATURE) throw new Error(`Could not validate signature: '${entry.sig}'`)
  return true
}

const getTestEntryValidator = (
  publicKey = DEFAULT_PUBLIC_KEY,
  sign = checkPermissionsAndSign,
  verify = checkPermissionsAndVerifySignature
) => ({
  publicKey,
  checkPermissionsAndSign: sign,
  checkPermissionsAndVerifySignature: verify
})

module.exports = getTestEntryValidator
module.exports.DEFAULT_SIGNATURE = DEFAULT_SIGNATURE
module.exports.DEFAULT_PUBLIC_KEY = DEFAULT_PUBLIC_KEY
