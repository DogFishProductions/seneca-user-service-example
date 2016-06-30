'use strict'

module.exports = {
  'conn': {
    'url': 'http://neo4j:7474/db/data/transaction/commit',
    'auth': {
      'user': 'neo4j',
      'pass': 'Paul~J4m'
    },
    'headers': {
      'accept': 'application/json; charset=UTF-8',
      'content-type': 'application/json',
      'x-stream': 'true'
    },
    'strictSSL': false
  },
  'map': { '-/sys/-': [ 'save', 'load', 'list', 'remove', 'native', 'saveRelationship', 'updateRelationship' ] },
  'merge': true
}