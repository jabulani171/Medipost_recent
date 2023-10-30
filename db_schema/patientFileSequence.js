var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var PatientFileSequenceSchema = new Schema({
  FileNumber     : {type: String, default: null},
  SequenceNo     : {type: Number, default: null}
}, { collection: 'PatientFileSequence'})

module.exports = mongoose.model('PatientFileSequence', PatientFileSequenceSchema);