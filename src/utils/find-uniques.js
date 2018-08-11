'use strict'

function findUniques (value, key) {
  // Create an index of the collection
  let uniques = {}
  var get = e => uniques[e]
  var addToIndex = e => (uniques[key ? e[key] : e] = e)
  value.forEach(addToIndex)
  return Object.keys(uniques).map(get)
}

module.exports = findUniques
