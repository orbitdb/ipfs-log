'use strict'
const appendEntries = async (log, height, { refCount, withEntries } = {}) => {
  const entries = []
  for (let i = 0; i < height; i++) {
    const entry = await log.append(Date.now(), refCount)
    if (withEntries) entries.push(entry)
  }
  return { entries }
}

module.exports = {
  createLog: require('./create-log'),
  height: 5000,
  appendEntries
}
