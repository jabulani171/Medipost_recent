var mongoose = require('mongoose');
var moment   = require('moment');
var Schema = mongoose.Schema

var auditLogsSchema = new Schema({
  TransactionID    : {type: String, default: null},
  Request          : {type: String, default: null},
  Response         : {type: String, default: null},
  Direction		   : {type: String, default: null},
  Status		   : {type: String, default: null},
  PluginID		   : {type: String, default: null},
  CreateDate       : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'AuditLogs'})

module.exports = mongoose.model('AuditLogs', auditLogsSchema)

/*
{
    "Packing_Station_IP":"127.0.0.1",
    "Packing_Station_ID":1
    "Label_Printer":"Laser",
    "ActivePatient":"02374565",
    "CartonID":"D0152560273"
}*/