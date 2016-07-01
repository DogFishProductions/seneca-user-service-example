var Seneca = require('seneca')().use('entity')
var Util = require('util')
var Q = require('q')

Seneca.ready(function (err, response) {
  if (err) {
    Seneca.log.error(_actionRole + '_store ready error', err)
  }

  var _act = Q.nbind(Seneca.act, Seneca)

  // send any role:math patterns out over the network
  // IMPORTANT: must match listening service
  Seneca.client({ host: "server", port: 9002, type: 'tcp', pin: { role: 'user' } })
 
  _act({ role: 'user', cmd: 'register' }, { name: "Flann O'Brien",email:'nincompoop@deselby.com',password:'blackair' })
 .then(function(out) {
    var _result = out[0]
    console.log("register success: " + _result.ok)
    if (!_result.ok) {
      console.log("register why: " + _result.why)
    }
    return _act({ role: 'user', cmd: 'login' }, { email: 'nincompoop@deselby.com', password: 'bicycle' })
  })
  .then(function(out) {
    var _result = out[0]
    console.log('invalid login success: ' + _result.ok)
    console.log("invalid register why: " + _result.why)
    return _act({ role: 'user', cmd: 'login' }, { email: 'nincompoop@deselby.com',password:'blackair' })
  })
  .then(function(out) {
    var _result = out[0]
    console.log('login success: ' + _result.ok)
    console.log('login instance: ' + _result.login)
    return _act({ role: 'user', cmd: 'login' }, { email: 'nincompoop@deselby.com',password:'blackair' })
  })
  .then(function(out) {
    var _result = out[0]
    console.log('login success: ' + _result.ok)
    console.log('login instance: ' + _result.login)
    return _act({ role: 'user', cmd: 'logout' }, { token: _result.login.id })
  })
  .then(function(out) {
    var _result = out[0]
    console.log('logout success: ' + _result.ok)
    console.log('logout instance: ' + _result.login)
    return _act({ role: 'user', cmd: 'deactivate' }, { email: 'nincompoop@deselby.com' })
  })
  .done(
    function(out) {
      var _result = out[0]
      console.log('deactivate success: ' + _result.ok)
    },
    function(err) {
      return console.log("error: " + err)
    }
  )
})