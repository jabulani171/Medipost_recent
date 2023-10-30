var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var TraySchema = new Schema({
  File_No : {type: String, index: {unique: true}},
  Collection_Point_Ref  : {type: String, default: null},
   Collection_Point : {type: String, default: null},
  Status         : {type: Number, default: null},
  Production_Batch : {type: String, default: null}
 
}, { collection: 'PackedPatient'})

module.exports = mongoose.model('PackedPatient', TraySchema);
