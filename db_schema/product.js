var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var ProductSchema = new Schema({
  EANCode        : {type: String, uppercase: true, index: {unique: true}},
  NSNCode		 : {type: String, default: null},
  ItemDescription: {type: String, default: null},
  CreateDate     : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}
}, { collection: 'Product'})

module.exports = mongoose.model('Product', ProductSchema);