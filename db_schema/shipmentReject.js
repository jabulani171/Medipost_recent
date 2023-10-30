var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var ShipmentRejectSchema = new Schema({
  CartonID         : {type: String, default: null},
  ShipmentID       : {type: String, default: null},
  Reason           : {type: String, default: null},
  Date             : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'ShipmentReject'})

module.exports = mongoose.model('ShipmentReject', ShipmentRejectSchema);