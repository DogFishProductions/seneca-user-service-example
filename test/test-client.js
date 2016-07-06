/* Copyright (c) 2016 Paul Nebel, MIT license */
'use strict'

var Seneca = require('seneca')

var Lab = require('lab')
var Code = require('code')
var lab = exports.lab = Lab.script()
var suite = lab.suite
var test = lab.test
var before = lab.before
var expect = Code.expect

var Q = require('q')

var _si = Seneca()

if (_si.version >= '2.0.0') {
  _si.use(require('seneca-entity'))
}

var _act = Q.nbind(_si.act, _si)
var _userData = {
  nick: 'nick1',
  name: "Flann O'Brien",
  email: 'nincompoop@deselby.com',
  password: 'blackair'
}

var login1
var login2

// send any role:math patterns out over the network
// IMPORTANT: must match listening service
_si.client({ port: 9002, type: 'tcp', pin: { role: 'user' } })

suite('seneca-user neo4j store tests', function () {
  before({}, function (done) {
    _si.ready(function (err) {
      if (err) {
        return process.exit(!console.error(err))
      }
      done()
    })
  })

  test('register', function (done) {
    _act({ role: 'user', cmd: 'register' }, _userData)
    .then(function (data) {
      // we're running the test again and haven't cleared the database
      if (data[0].why === 'nick-exists') {
        expect(data[0].ok).to.be.false()
        expect(data[0].nick).to.equal(_userData.nick)
        // activate the user we deactivated at the end of the last run
        return _act({ role: 'user', cmd: 'activate' }, { email: 'nincompoop@deselby.com' })
      }
      return data
    })
    .done(
      function (registration) {
        expect(registration[0].ok).to.be.true()
        expect(registration[0].user.nick).to.equal(_userData.nick)
        expect(registration[0].user.active).to.be.true()
        done()
      },
      function (err) {
        console.log('err: ' + err)
        done(err)
      }
    )
  })

  test('login wrong password', function (done) {
    _act({ role: 'user', cmd: 'login' }, { email: 'nincompoop@deselby.com', password: 'bicycle' })
    .done(
      function (failure) {
        expect(failure[0].ok).to.be.false()
        expect(failure[0].why).to.equal('invalid-password')
        done()
      },
      function (err) {
        console.log('err: ' + err)
        done(err)
      }
    )
  })

  test('login 0 correct password', function (done) {
    _act({ role: 'user', cmd: 'login' }, { email: 'nincompoop@deselby.com', password: 'blackair' })
    .done(
      function (success) {
        expect(success[0].ok).to.be.true()
        expect(success[0].why).to.equal('password')
        expect(success[0].user.nick).to.equal(_userData.nick)
        expect(success[0].login).to.exist()
        expect(success[0].login.active).to.be.true()
        done()
      },
      function (err) {
        console.log('err: ' + err)
        done(err)
      }
    )
  })

  test('login 1 correct password', function (done) {
    _act({ role: 'user', cmd: 'login' }, { email: 'nincompoop@deselby.com', password: 'blackair' })
    .done(
      function (success) {
        expect(success[0].ok).to.be.true()
        expect(success[0].why).to.equal('password')
        expect(success[0].user.nick).to.equal(_userData.nick)
        login1 = success[0].login
        expect(login1).to.exist()
        expect(login1.active).to.be.true()
        done()
      },
      function (err) {
        console.log('err: ' + err)
        done(err)
      }
    )
  })

  test('login 2 correct password', function (done) {
    _act({ role: 'user', cmd: 'login' }, { email: 'nincompoop@deselby.com', password: 'blackair' })
    .done(
      function (success) {
        expect(success[0].ok).to.be.true()
        expect(success[0].why).to.equal('password')
        expect(success[0].user.nick).to.equal(_userData.nick)
        login2 = success[0].login
        expect(login2).to.exist()
        expect(login2.active).to.be.true()
        done()
      },
      function (err) {
        console.log('err: ' + err)
        done(err)
      }
    )
  })

  test('logout 2', function (done) {
    _act({ role: 'user', cmd: 'logout' }, { token: login2.id })
    .done(
      function (logout2_data) {
        expect(logout2_data[0].ok).to.be.true()
        expect(logout2_data[0].user.nick).to.equal(_userData.nick)
        expect(logout2_data[0].login).to.exist()
        expect(logout2_data[0].login.active).to.be.false()
        done()
      },
      function (err) {
        console.log('err: ' + err)
        done(err)
      }
    )
  })

  test('logout 1', function (done) {
    _act({ role: 'user', cmd: 'logout' }, { token: login1.id })
    .done(
      function (logout1_data) {
        expect(logout1_data[0].ok).to.be.true()
        expect(logout1_data[0].user.nick).to.equal(_userData.nick)
        expect(logout1_data[0].login).to.exist()
        expect(logout1_data[0].login.active).to.be.false()
        done()
      },
      function (err) {
        console.log('err: ' + err)
        done(err)
      }
    )
  })

  test('deactivate', function (done) {
    _act({ role: 'user', cmd: 'deactivate' }, { email: 'nincompoop@deselby.com' })
    .done(
      function (data) {
        expect(data[0].ok).to.be.true()
        done()
      },
      function (err) {
        console.log('err: ' + err)
        done(err)
      }
    )
  })
})
