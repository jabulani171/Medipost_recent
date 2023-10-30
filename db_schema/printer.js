var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var PrinterSchema = new Schema({
  PrinterName    : {type: String, default: null},
  PrinterQueue   : {type: String, default: null},
  PrinterType    : {type: String, default: null},
  Description    : {type: String, default: null},
  CreateDate     : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')},
  LastUpdate     : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'SysPrinters'});

module.exports = mongoose.model('SysPrinters', PrinterSchema)