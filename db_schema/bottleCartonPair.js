var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var PairDetailSchema = new Schema({
  BatchID                  : {type: String, default: null},
  CartonID                 : {type: String, default: null},
  Bottle1                  : {type: String, default: null},
  Bottle2                  : {type: String, default: null},
  PatientName              : {type: String, default: null},
  Status                   : {type: String, default: null},
  PickupPoint              : {type: String, default: null},
  Line                     : {type: Number, default: null},
  Processed                : {type: Boolean, default: false},
  Reprint                  : {type: Boolean, default: false},
  CreateDate               : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')},
  LastUpdate               : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'BottleCartonPair'})

module.exports = mongoose.model('BottleCartonPair', PairDetailSchema);
