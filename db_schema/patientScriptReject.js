var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var PatientScriptRejectSchema = new Schema({
  CartonID         : {type: String, default: null},
  PatientScript    : {type: String, default: null},
  BatchID		   : {type: String, default: null},
  Reason           : {type: String, default: null},
  Date             : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'PatientScriptReject'})

module.exports = mongoose.model('PatientScriptReject', PatientScriptRejectSchema);