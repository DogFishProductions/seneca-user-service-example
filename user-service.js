/* jslint node: true */
'use strict'

/** neo4j-store-service
 *  @summary Interface for Neo4j persistence microservice
 */
var _ = require('lodash')
var Seneca = require('seneca')
var Fs = require('fs')
var Q = require('q')

var _si = Seneca()

var _dbConfig
if (Fs.existsSync(__dirname + '/config/dbConfig.mine.js')) {
  _dbConfig = require('./config/dbConfig.mine')
}
else {
  _dbConfig = require('./config/dbConfig.example')
}

var _senecaConfig
if (Fs.existsSync(__dirname + '/config/config.mine.js')) {
  _senecaConfig = require('./config/config.mine')
}
else {
  _senecaConfig = require('./config/config.example')
}

var _actionRole = _senecaConfig.role


_si.use('neo4j-store', _dbConfig).use('user')
if (_si.version >= '2.0.0') {
  _si.use(require('seneca-entity'))
}

/** @function _getEntityWithIdOnly
 *
 *  @summary Returns an entity created using the canon of the parameter with just the id set.
 *
 *  @since 1.0.0
 *
 *  @param    {Object}  ent - The entity on which the result is based.
 *
 *  @returns  {Object} The bare bones entity.
 */
var _getEntityWithIdOnly = function (ent) {
  var _entity = _si.make$(ent.canon$())
  _entity.id = ent.id
  return _entity
}

var _cypherTimelineTemplate = _.template('MATCH (n:<%= nodeName %> { id: "<%= id %>" }) WITH n CALL ga.timetree.events.attach({node: n, resolution: "<%= resolution %>", time: <%= time %>, timezone: "<%= timezone %>", relationshipType: "<%= relationshipType %>"}) YIELD node RETURN node')

/** @function _addEntityToTimeline
 *
 *  @summary Adds the entity passed in as a parameter to the database timeline.
 *
 *  @since 1.0.0
 *
 *  @param    {Object}  options.ent - The entity to be added to the timeline.
 *  @param    {Date}    options.time - The time to which the entity is to be added.
 *  @param    {string}  options.resolution - The resolution of the timeline to which the entity is to be added.
 *  @param    {string}  options.timezone - The timezone to which the entity is to be added.
 *  @param    {string}  options.relationship - The type of the relationship by which the entity is added to the timeline.
 *
 *  @returns  {Object} The promise of a result.
 */
var _addEntityToTimeline = function (options) {
  var _deferred = Q.defer()
  var _ent = options.ent
  if (_ent) {
    // Don't forget to deal with timezones here - it's UTC unless you set it to something different...
    var _time = (options.time ? Date.parse(options.time) : Date.now)
    var _res = options.resolution || 'Second'
    var _tz = options.timezone || 'UTC'
    var _type = options.relationshipType || 'RELATIONSHIP'
    _ent.native$(function (err, dbinst) {
      if (err) {
        _si.log.error(_actionRole + ' add login to timetree failed.', err)
        _deferred.reject(err)
      }
      var _cypher = _cypherTimelineTemplate({
        'nodeName': _ent.canon$({ object: true }).name,
        'id': _ent.id,
        'resolution': _res,
        'time': _time,
        'timezone': _tz,
        'relationshipType': _type
      })
      _promisify(dbinst, 'query', { cypher: _cypher })
      .done(
        function (results) {
          _deferred.resolve(results)
        },
        function (err) {
          _si.log.error(_actionRole + ' add login to timetree failed.', err)
          _deferred.reject(err)
        }
      )
    })
  }
  else {
    _deferred.reject(new Error('No entity supplied'))
  }
  return _deferred.promise
}

/** @function _promisify
 *
 *  @summary Wraps the supplied method invocation in a promise.
 *
 *  @since 1.0.0
 *
 *  @param    {Object}  context - The object on which the method is to be invoked.
 *  @param    {string}  action - The name of the method to be invoked.
 *  @param    {Array}   args - The arguments to be passed to the method invocation.
 *
 *  @returns  {Object} The promise of a result.
 */
var _promisify = function (context, action, args) {
  var _deferred = Q.defer()
  context[action](args, function (err, result) {
    if (err) {
      _deferred.reject(err)
    }
    else {
      _deferred.resolve(result)
    }
  })
  return _deferred.promise
}

_si.ready(function (err, response) {
  if (err) {
    _si.log.error(_actionRole + ' User Service ready error', err)
  }
  var _realm = _si.make$('-/sys/realm')
  _realm.scope = 'UK'
  // only create a realm if it doesn't already exist...
  // list, not load, as we don't know its id yet...
  _promisify(_realm, 'list$', { scope: 'UK' })
  .then(function (existing_realms) {
    if (_.isEmpty(existing_realms)) {
      return _promisify(_realm, 'save$')
    }
    else {
      return existing_realms
    }
  })
  .done(
    function (realms) {
      _realm = _.castArray(realms)[0]
    },
    function (err) {
      _si.log.error(_actionRole + ' Error retrieving realm.', err)
    }
  )

  _si.add({ role: _actionRole, cmd: 'register' }, function (args, next) {
    // this calls the original action, as provided by the user plugin
    _promisify(this, 'prior', args)
    .done(
      function (registration) {
        var _realmId
        if (_realm) {
          _realmId = _realm.id
        }
        if (registration.ok && _realmId) {
          // add the user to the realm (the realm to which the user is to be added could be determined by the
          // sub-domain or the type of the originating URL)
          var _user = registration.user
          var _userId = _user.id
          var _rel = {
            relatedNodeLabel: 'user',
            type: 'HAS_USER',
            data: {
              active: _user.active
            }
          }
          _promisify(_realm, 'saveRelationship$', { relationship$: _rel, id: _userId })
          .then(function (relationship) {
            // once we've registered the user with the realm, add the registration time to the timeline
            return _addEntityToTimeline({
              ent: _user,
              time: _user.when,
              relationshipType: 'REGISTERED_ON'
            })
          })
          .done(
            function (result) {
              next(null, registration)
            },
            function (err) {
              _si.log.error(_actionRole + ' add login to timetree failed.', err)
              next(err)
            }
          )
        }
        else {
          next(null, registration)
        }
      },
      function (err) {
        _si.log.error(_actionRole + ' login failed.', err)
      }
    )
  })

  _si.add({ role: _actionRole, cmd: 'login' }, function (args, next) {
    // this calls the original action, as provided by the user plugin
    _promisify(this, 'prior', args)
    .done(
      function (new_login) {
        if (new_login.ok) {
          var _login = new_login.login
          var _user = _getEntityWithIdOnly(new_login.user)
          var _rel = {
            relatedNodeLabel: 'login',
            type: 'ACTIVE_LOGIN'
          }
          // create a relationship to the new login that lets us find it easily
          _promisify(_user, 'saveRelationship$', { relationship$: _rel, id: _login.id })
          .then(function (saved_relationship) {
            return _addEntityToTimeline({
              ent: _login,
              time: _login.when,
              relationshipType: 'LOGGED_IN_AT'
            })
          })
          .done(
            function () {
              // return the login we just created...
              next(null, new_login)
            },
            function (err) {
              _si.log.error(_actionRole + ' add login to timetree failed.', err)
            }
          )
        }
        else {
          next(null, new_login)
        }
      },
      function (err) {
        _si.log.error(_actionRole + ' login failed.', err)
      }
    )
  })

  var deactivateLogin = function (login_result) {
    var _deferred = Q.defer()
    if (login_result.ok) {
      var _login = login_result.login
      var _user = _getEntityWithIdOnly(login_result.user)
      var _old_head
      // get the login currently at the head of the 'INACTIVE_LOGINS' linked list
      _promisify(_user, 'list$', { relationship$: { relatedNodeLabel: 'login', type: 'INACTIVE_LOGINS', data: { limit$: 1, sort$: { ended: -1 } } } })
      .then(function (inactive_logins) {
        // remove the old latest from the head of the linked list
        if (!_.isEmpty(inactive_logins)) {
          _old_head = inactive_logins[0]
          return _promisify(_user, 'remove$', { relationship$: { relatedNodeLabel: 'login', type: 'INACTIVE_LOGINS' }, id: _old_head.id })
        }
      })
      .then(function () {
        // remove the ACTIVE_LOGIN relationship from the latest logout
        return _promisify(_user, 'remove$', { relationship$: { relatedNodeLabel: 'login', type: 'ACTIVE_LOGIN' }, id: _login.id })
      })
      .then(function () {
        // add the latest logout to the head of the list
        return _promisify(_user, 'saveRelationship$', { relationship$: { relatedNodeLabel: 'login', type: 'INACTIVE_LOGINS' }, id: _login.id })
      })
      .then(function (saved_relationship) {
        // add the old head as next in the list
        if (_old_head) {
          return _promisify(_login, 'saveRelationship$', { relationship$: { relatedNodeLabel: 'login', type: 'NEXT' }, id: _old_head.id })
        }
      })
      .then(function (saved_relationship) {
        // if it's still active, deactivate the current login
        if (_login.active) {
          _login.active = false
          _login.ended = Date.now()
          return _promisify(_login, 'save$')
        }
        return
      })
      .done(
        function (updated_login) {
          // return the login we just updated...
          _deferred.resolve(login_result)
        },
        function (err) {
          _si.log.error(_actionRole + ' updating login linked list failed.', err)
          _deferred.reject(err)
        }
      )
    }
    else {
      _deferred.resolve(login_result)
    }
    return _deferred.promise
  }

  _si.add({ role: _actionRole, cmd: 'logout' }, function (args, next) {
    // this calls the original action, as provided by the user plugin
    _promisify(this, 'prior', args)
    .then(function (login_result) {
      return deactivateLogin(login_result)
    })
    .done(
      function (login_result) {
        next(null, login_result)
      },
      function (err) {
        _si.log.error(_actionRole + ' login failed.', err)
      }
    )
  })

  _si.add({ role: _actionRole, cmd: 'deactivate' }, function (args, next) {
    // this calls the original action, as provided by the user plugin
    _promisify(this, 'prior', args)
    .done(
      function (result) {
        if (result.ok) {
          // update the HAS_USER relationship to active: false
          var _realm = _si.make$('-/sys/realm')
          _realm.scope = 'UK'
          var _user = _si.make$('-/sys/user')
          var _data = {
            relationship$: {
              relatedNodeLabel: 'user',
              type: 'HAS_USER',
              data: { active: false }
            }
          }
          if (args.nick) {
            _data.nick = args.nick
            _user.nick = args.nick
          }
          if (args.email) {
            _data.email = args.email
            _user.email = args.email
          }
          _promisify(_realm, 'updateRelationship$', _data)
          .then(function (updated_relationship) {
            // now get the user
            return _promisify(_user, 'list$', { limit$: 1 })
          })
          .then(function (user_list) {
            if (!user_list || _.isEmpty(user_list)) {
              throw new Error("can't find user: " + _user)
            }
            _user = user_list[0]
            // find all active logins for this user
            return _promisify(_user, 'list$', { relationship$: { relatedNodeLabel: 'login', type: 'ACTIVE_LOGIN' }, sort$: { when: 1 } })
          })
          .then(function (active_logins) {
            var _contexts = []
            active_logins.forEach(function (current_login) {
              _contexts.push({ ok: true, login: current_login, user: _user })
            })
            // deactivate all the active logins for this user
            return Q.allSettled(_contexts.map(deactivateLogin))
          })
          .done(
            function (allResults) {
              next(null, result)
            },
            function (err) {
              _si.log.error(_actionRole + ' update relationship failed.', err)
            }
          )
        }
        else {
          next(null, result)
        }
      },
      function (err) {
        _si.log.error(_actionRole + ' deactivate failed.', err)
      }
    )
  })

  _si.listen({ port: _senecaConfig.port, type: _senecaConfig.type, pin: { role: _actionRole } })
})
