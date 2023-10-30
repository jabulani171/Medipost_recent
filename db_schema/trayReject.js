var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var TrayRejectSchema = new Schema({
  Script_Number           : {type: String, default: null},
  Reason           : {type: String, default: null},
  Date             : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'BottleReject'})

module.exports = mongoose.model('BottleReject', TrayRejectSchema);