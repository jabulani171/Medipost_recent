var mongoose = require('mongoose');
var moment   = require('moment');
var Schema = mongoose.Schema

var paramSchema = new Schema({

  IncomingBatchFileDir          : {type: String, default: null},
  SuccessBatchFileDir           : {type: String,default:null},
  FailedBatchFileDir            : {type:String,default:null},
  MultBottleBatches             : {type:Boolean,default:null},
  PlcCheckTimeMsecs             : {type:Number,default:null}

}, { collection: 'SysParams'})

module.exports = mongoose.model('SysParams', paramSchema)