var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var ShelfSchema = new Schema({
  Shelf     : {type: String, default: null},
  Tray      : {type: String, default: null},
  Incoming  : {type: String, default: null}
}, { collection: 'Shelf'})

module.exports = mongoose.model('Shelf', ShelfSchema);