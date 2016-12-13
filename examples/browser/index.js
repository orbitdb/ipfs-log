'use strict'

const IPFS = require('ipfs-api')
const Log = require('../../src/log')

const ipfs = new IPFS()
const log = new Log(ipfs, 'A')

const outputElm = document.getElementById('output')
outputElm.innerHTML = ''
outputElm.innerHTML += "> <b>const IPFS = require('ipfs-api')</b>\n"
outputElm.innerHTML += "> <b>const Log = require('ipfs-log')</b>\n\n"
outputElm.innerHTML += '> <b>const ipfs = new IPFS()</b>\n'
outputElm.innerHTML += "> <b>const log = new Log(ipfs, 'uid')</b>\n\n"

log.add('one')
  .then((entry1) => {
    console.log('Entry1:', entry1.hash, entry1.payload, entry1)
    outputElm.innerHTML += "> <b>log.add('one')</b>\n" + entry1.hash + '\n\n'
    return log.add('two')
  })
  .then((entry2) => {
    console.log('Entry2:', entry2.hash, entry2.payload, entry2)
    console.log('Entry2.next:', entry2.next[0])
    outputElm.innerHTML += "> <b>log.add('two')</b>\n" + entry2.hash + '\n\n'
    return
  })
  .then(() => {
    outputElm.innerHTML += '> <b>log.items</b>\n'
    outputElm.innerHTML += JSON.stringify(log.items, null, 2)
  })
