var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var batchSummarySchema = new Schema({
	Production_Batch             : {type: String, index: {unique: true}},
	Patients                     : {type: Number, default: null},
	Processed                    : {type: Number, default: null},
	Date_Required                : {type: String, default: null},
	Status                       : {type: Number, default: null},
	created_at                   : { type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')},
	updated_at                   : { type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')}

}, { collection: 'BatchSummary'})

module.exports = mongoose.model('BatchSummary', batchSummarySchema);