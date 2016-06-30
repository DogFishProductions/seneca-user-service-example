/* jslint node: true */
'use strict'

/** neo4j-store-service
 *  @summary Interface for Neo4j persistence microservice
 */
var _ = require('lodash')
var Seneca = require('seneca')
var Fs = require('fs')
var Util = require('util')
var Q = require('q')

var _si = Seneca({
  default_plugins: {
    'mem-store': false
  }
})

var _dbConfig
if (Fs.existsSync(__dirname + '/dbConfig.mine.js')) {
  _dbConfig = require('./dbConfig.mine')
}
else {
  _dbConfig = require('./dbConfig.example')
}

var _senecaConfig
if (Fs.existsSync(__dirname + '/config.mine.js')) {
  _senecaConfig = require('./config.mine')
}
else {
  _senecaConfig = require('./config.example')
}

var _actionRole = _senecaConfig.role

var _getEntityWithIdOnly = function (ent) {
  var _entity = _si.make$(ent.canon$())
  _entity.id = ent.id
  return _entity
}

var _cypherTimelineTemplate = _.template('MATCH (n:<%= nodeName %> { id: "<%= id %>" }) WITH n CALL ga.timetree.events.attach({node: n, resolution: "<%= resolution %>", time: <%= time %>, timezone: "<%= timezone %>", relationshipType: "<%= relationshipType %>"}) YIELD node RETURN node')
var _addEntityToTimeline = function (options) {
  var _deferred = Q.defer()
  var _ent = options.ent
  if (_ent) {
    // Don't forget to deal with timezones here - it's UTC unless you set it to something different...
    var _time = (options.time ? Date.parse(options.time) : Date.now)
    var _res = options.resolution || "Second"
    var _tz = options.timezone || "UTC"
    var _type = options.relationshipType || "RELATIONSHIP"
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
      _promisify(dbinst, "query", { cypher: _cypher })
      .done(
        function (results){
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
    _deferred.reject(new Error("No entity supplied"))
  }
  return _deferred.promise
}

var _promisify = function (context, action, args) {
  var _deferred = Q.defer()
  context[action](args, function(err, result) {
    if (err) {
      _deferred.reject(err)
    }
    else {
      _deferred.resolve(result)
    }
  })
  return _deferred.promise
}

_si.use('entity').use('neo4j-store', _dbConfig).use('user')

_si.ready(function (err, response) {
  if (err) {
    _si.log.error(_actionRole + ' User Service ready error', err)
  }

  var _realm = _si.make$('-/sys/realm')
  _realm.scope = "UK"
  // only create a realm if it doesn't already exist...
  // list, not load, as we don't know it's id yet...
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
      return _si.log.error(_actionRole + ' Error retrieving realm.', err)
    }
  )

  _si.add({ role: _actionRole, cmd: 'register' }, function (args, next) {
    console.log("###### register")
    // this calls the original action, as provided by the user plugin 
      _promisify(this, 'prior', args)
      .done(
        function (registration) {
          var _realmId
          if (_realm) {
            _realmId = _realm.id
          } 
          if (registration.ok && _realmId) {
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
              return _addEntityToTimeline({
                ent: _user,
                time: _user.when,
                relationshipType: "REGISTERED_ON"
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
          return _si.log.error(_actionRole + ' login failed.', err)
        }
      )
  })

  _si.add({ role: _actionRole, cmd: 'login' }, function (args, next) {
    console.log("###### login")
    // this calls the original action, as provided by the user plugin 
    _promisify(this, 'prior', args)
    .done(
      function (new_login) {
        if (new_login.ok) {
          var _login = new_login.login
          var _loginId = _login.id
          var _user = _getEntityWithIdOnly(new_login.user)
          var _rel = {
            relatedNodeLabel: 'login',
            type: 'HAS_LOGIN',
            data: {
              active: _login.active
            }
          }
          var _old_latest
          var _new_latest
          var _next_latest
          _promisify(_user, 'saveRelationship$', { relationship$: _rel, id: _loginId })
          .then( function(saved_relationship) {
            return _addEntityToTimeline({
              ent: _login,
              time: _login.when,
              relationshipType: "ACTIVE_LOGIN"
            })
          })
          .then(function (instant) {
            // get the login currently related as the 'LATEST'
            return _promisify(_user, 'list$', { relationship$: { relatedNodeLabel: 'login', type: 'LATEST' } })
          })
          .then(function (latest) {
            _old_latest = latest
            // get the two most recent logins
            return _promisify(_user, 'list$', { relationship$: { relatedNodeLabel: 'login', type: 'HAS_LOGIN', data: { limit$: 2, sort$: { when: -1 } } } })
          })
          .then(function (_most_recent_logins) {
            if (_most_recent_logins.length > 0) {
              _new_latest = _most_recent_logins[0]
              _next_latest = _most_recent_logins[1]
              // set the latest login as the head of the linked list
              return _promisify(_user, 'saveRelationship$', { relationship$: { relatedNodeLabel: 'login', type: 'LATEST' }, id: _new_latest.id })
              .then(function (latest_relationship) {
                // set the next most recent login to be the next in the list
                if (_next_latest) {
                  return _promisify(_new_latest, 'saveRelationship$', { relationship$: { relatedNodeLabel: 'login', type: 'NEXT' }, id: _next_latest.id })
                }
                return
              })
              .done(
                function (next_relationship) {
                  // remove the old latest from the head of the linked list
                  if (!_.isEmpty(_old_latest)) {
                    _old_latest.forEach(function (current_old_latest) {
                      _promisify(_user, 'remove$', { relationship$: { relatedNodeLabel: 'login', type: 'LATEST' }, id: current_old_latest.id })
                    }) 
                  }
                },
                function (err) {
                  return _si.log.error(_actionRole + ' updating login linked list failed.', err)
                } 
              )
            }
            else return
          })
          .done(
            function () {
              // return the login we just created...
              next(null, new_login)
            },
            function (err) {
              return _si.log.error(_actionRole + ' add login to timetree failed.', err)
            }
          )
        }
        else {
          next(null, new_login)
        }
      },
      function (err) {
        return _si.log.error(_actionRole + ' login failed.', err)
      }
    )
  })

  _si.add({ role: _actionRole, cmd: 'logout' }, function (args, next) {
    console.log("###### logout")
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

/*

  _si.add({ role: _actionRole, cmd: 'logout' }, function (args, next) {
  	console.log("###### logout:: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

  _si.add({ role: _actionRole, cmd: 'auth' }, function (args, next) {
  	console.log("###### auth:: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

  _si.add({ role: _actionRole, cmd: 'create_reset' }, function (args, next) {
  	console.log("###### create_reset:: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

  _si.add({ role: _actionRole, cmd: 'load_reset' }, function (args, next) {
  	console.log("###### load_reset:: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

  _si.add({ role: _actionRole, cmd: 'execute_reset' }, function (args, next) {
  	console.log("###### execute_reset:: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

  _si.add({ role: _actionRole, cmd: 'encrypt_password' }, function (args, next) {
  	console.log("###### encrypt_password:: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

  _si.add({ role: _actionRole, cmd: 'verify_password' }, function (args, next) {
  	console.log("###### verify_password:: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

  _si.add({ role: _actionRole, cmd: 'update' }, function (args, next) {
  	console.log("###### update:: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

  _si.add({ role: _actionRole, cmd: 'remove' }, function (args, next) {
  	console.log("###### remove:: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

  _si.add({ role: _actionRole, cmd: 'activate' }, function (args, next) {
  	console.log("###### activate:: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })

  _si.add({ role: _actionRole, cmd: 'deactivate' }, function (args, next) {
  	console.log("###### deactivate :: args: " + Util.inspect(args))
    // this calls the original action, as provided by the user plugin 
      this.prior(args,next)
  })//*/

  _si.listen({ port: _senecaConfig.port, type: _senecaConfig.type, pin: { role: _actionRole } })
})

var createEntity = function (args) {
  var _ent = args.ent
  var _node = _si.make(_ent.zone, _ent.base)
  var _props = _ent.properties || {}
  var _keys = _.keys(_props)
  _keys.forEach(function (key) {
    _node[key] = _props[key]
  })
  return _node
}
