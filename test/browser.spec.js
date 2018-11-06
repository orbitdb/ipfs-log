'use strict'

const isNode = require('is-node')

// This file will be picked up by webpack into the 
// tests bundle and the code here gets run when imported
// into the browser tests index through browser/run.js
if (!isNode) {
  // If in browser, put the fixture keys in local storage
  // so that Keystore can find them
  const keyA = require('./fixtures/keys/userA')
  const keyB = require('./fixtures/keys/userB')
  const keyC = require('./fixtures/keys/userC')
  const keyD = require('./fixtures/keys/userD')
  localStorage.setItem('userA', JSON.stringify(keyA))
  localStorage.setItem('userB', JSON.stringify(keyB))
  localStorage.setItem('userC', JSON.stringify(keyC))
  localStorage.setItem('userD', JSON.stringify(keyD))
}
