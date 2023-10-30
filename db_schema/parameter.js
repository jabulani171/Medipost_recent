var mongoose = require('mongoose');
var moment   = require('moment');
var Schema = mongoose.Schema

var paramSchema = new Schema({
  ParameterName		  : {type: String, default: null},
  ParamDesc  		  : {type: String, default: null},
  Fields              : {}
}, { collection: 'SysParams'})

module.exports = mongoose.model('SysParams', paramSchema)