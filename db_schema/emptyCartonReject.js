var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var EmptyCartonRejectSchema = new Schema({
  CartonID         : {type: String, default: null},
  BatchID		   : {type: String, default: null},
  Reason           : {type: String, default: null},
  Date             : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'EmptyCartonReject'})

module.exports = mongoose.model('EmptyCartonReject', EmptyCartonRejectSchema);