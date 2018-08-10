
const isFunction = fn => fn && fn.call && fn.apply && typeof fn === 'function'

module.exports = isFunction
