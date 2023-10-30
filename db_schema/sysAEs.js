var mongoose = require('mongoose');
var moment   = require('moment');
var Schema = mongoose.Schema

var sysAESchema = new Schema({
  Type     	       : {type: String, default: null},
  UsersViewed      : [],
  Message		   : {type: String, default: null},
  created_at       : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'SysAE'})

module.exports = mongoose.model('SysAE', sysAESchema)