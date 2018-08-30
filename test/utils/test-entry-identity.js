const Log = require('../../src/log')

const { ACL, Identity, IdentityProvider } = Log
const DEFAULT_PUBLIC_KEY = 'key'
const DEFAULT_SIGNATURE = 'deadbeef'
// If the entry has no key, we're signing it so for test purposes, just return true
// We can overwrite that and specify pass a custom function if necessary
const defaultPermissionCheckingFn = publicKey => (key, entry) => {
  if (!entry) throw new Error('Invalid test entry')
  if (!key) throw new Error('Invalid test key')
  if (!entry.key) return true
  return (key === publicKey && entry.key === key)
}

const defaultJoinPermissionCheckingFn = keys => (key, entry) => {
  if (!entry) throw new Error('Invalid test entry')
  if (!key) throw new Error('Invalid test key')
  if (!entry.key) return true
  return keys && keys.length && keys.includes(key)
}

const defaultSigningFn = () => DEFAULT_SIGNATURE
const defaultVerificationFn = (sig, key, data) => (data && key && sig === DEFAULT_SIGNATURE)

const getTestIdentity = (
  publicKey = DEFAULT_PUBLIC_KEY,
  signFn,
  verifyFn
) => {
  const id = publicKey
  const signingFn = signFn || defaultSigningFn
  const verifyingFn = verifyFn || defaultVerificationFn
  const provider = new IdentityProvider(signingFn, verifyingFn)
  return new Identity(id, publicKey, provider)
}

const getTestACL = (
  publicKey = DEFAULT_PUBLIC_KEY,
  checkPermissionFn
) => {
  const permissionCheckingFn = checkPermissionFn || defaultPermissionCheckingFn(publicKey)
  return new ACL(permissionCheckingFn)
}

module.exports = {
  defaultJoinPermissionCheckingFn,
  getTestIdentity,
  getTestACL,
  DEFAULT_PUBLIC_KEY,
  DEFAULT_SIGNATURE
}
