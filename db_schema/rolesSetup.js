var mongoose = require('mongoose');
var moment   = require('moment');
var Schema = mongoose.Schema

var rolesSetupSchema = new Schema({
  TransactionID    : {type: String, default: null},
  Log   		   : {type: String, default: null},
  PluginID		   : {type: String, default: null},
  UserID		   : {type: String, default: null},
  CreateDate       : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'UserRoles'})

module.exports = mongoose.model('UserRoles', rolesSetupSchema)