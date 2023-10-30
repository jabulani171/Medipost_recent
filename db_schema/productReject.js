var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var productRejectSchema = new Schema({
  ProdID         : {type: String, default: null},
  BatchID		 : {type: String, default: null},
  Reason		 : {type: String, default: null},
  Date           : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'ProductReject'})

module.exports = mongoose.model('ProductReject', productRejectSchema);