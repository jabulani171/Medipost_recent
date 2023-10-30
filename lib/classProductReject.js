var db          = require('../db_schema/productReject');
var dec         = require('../lib/declaration');
var moment      = require('moment');

function _CreateRecord(Object, callback){
	let Record = new db(Object);

	Record.save(function (err, savedDoc){
		return callback({Err:err, SavedDoc: savedDoc});
	});
} /* _CreateRecord */

module.exports = class ProductReject {
    constructor(){}

    New(Object, callback){
		_CreateRecord(Object, function(Resp){
			return callback(Resp);
		});
	} /* New */

	DeleteRecord(KeyValuePair, callback){
		db.deleteOne(KeyValuePair, function(err, Resp){
			if(err){
				return callback({Err: err})
			}

			return callback({DeleteResp: Resp});
		});
	} /* DeleteRecord */

	Find(KeyValuePair, callback){
		db.find(KeyValuePair, function(err, Arr){
			if(err){
				return callback({Err: err});
			}

			if(Arr.length > 0){
				return callback({Arr: Arr});
			}

			return callback({Arr: null});
		});
	} /* Find */

	FindOne(KeyValuePair, callback){
		db.findOne(KeyValuePair, function(err, Rec){
			if(err){
				return callback({Err: err});
			}

			if(!Rec){
				return callback({Rec: null});
			}

			return callback({Rec: Rec});
		});
	} /* FindOne */

	Update(UpdateObject, callback){
		if(!UpdateObject){
			return callback({SavedDoc:null});
		}

		//UpdateObject.markModified('Fields');
		UpdateObject.save(function(err, savedDoc){
			return callback({SavedDoc: savedDoc});
		});
	} /* Update */

} /* ProductReject */