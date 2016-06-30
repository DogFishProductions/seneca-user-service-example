/**
 * @function
 *
 * world is a constructor function
 * with utility properties,
 * destined to be used in step definitions
 */
var Q = require('q');
var cwd = process.cwd();
var path = require('path');

var Service = require(path.join(cwd, '..', 'tests', 'lib', 'mtac'));

module.exports = function() {
    this.mtac = new Service();
    this.expect = require('chai').expect;
    this.getDeferred = function() {
    	return Q.defer();
    }
}