var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var PackingStationSchema = new Schema({
  Packing_Station_IP         : {type: String,default:null},
  Packing_Station_ID         : {type: String,default:null},
  Label_Printer              : {type: String,default:null},
  ActivePatient              : {type: String,default:null},
  CartonID                    : {type: String,default:null}
}, { collection: 'PackingStation'})

module.exports = mongoose.model('PackingStation', PackingStationSchema);