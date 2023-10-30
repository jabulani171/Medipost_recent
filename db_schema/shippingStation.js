var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var ShippingStationSchema = new Schema({
  Shipping_Station_IP         : {type:String,default:null},
  Shipping_Station_ID         : {type: Number, default: null},
  Label_Printer               : {type:String,default:null},
  ActiveWaybill                : {type: String, index: {unique: true}},
  Cartons                      : {type:Number,default:null},
  ProcessedCartons             : {type:Number,default:null}
}, { collection: 'ShippingStation'})

module.exports = mongoose.model('ShippingStation', ShippingStationSchema);