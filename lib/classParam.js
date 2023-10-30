var moment = require('moment');
var auditlogs  = require('../db_schema/auditLogs');
var Param  = require('../db_schema/parameter');
var dec    = require('./declaration');

function _CreateParameter(Object, callback){
	Param.create(Object, function(err, SavedDoc){
		if(err){
			return callback({Err: err});
		} else {
			if(SavedDoc){
				return callback({SavedDoc: SavedDoc});
			} else {
				return callback({SavedDoc: null});
			}
		}
	});
} /* _CreateNewParam */


module.exports = class SysParams {
    constructor(){}

 	New(Object, callback){
 		_CreateParameter(Object, function(Resp){
 			return callback(Resp);
 		});
	} /* NewParam */

	FindOne(KeyValuePair, callback){
		Param.findOne(KeyValuePair, function(err, Param){
			if(err){
				return callback({Err: err, Param: null});
			} else {
				if(Param){
					return callback({Err: null, Param: Param});
				} else {
					return callback({Err: null, Param: null});
				}
			}
		});
	} /* FindOne */

	Find(KeyValuePair, callback){
		Param.find(KeyValuePair, function(err, Params){
			if(err){
				return callback({Err: err, Params: null});
			} else {
				if(Params.length > 0){
					return callback({Err: null, Params: Params});
				} else {
					return callback({Err: null, Params: null});
				}
			}
		});
	} /* Find */

	Update(UpdateObject, callback){
		if(UpdateObject){
			UpdateObject.markModified('Fields');
			UpdateObject.save(function(err, savedDoc){
				return callback({SavedDoc: savedDoc});
			});
		} else {
			return callback({SavedDoc:null});
		}
	} /* Update */
}