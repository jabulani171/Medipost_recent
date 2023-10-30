var ae          = require('../db_schema/sysAEs');
var moment      = require('moment');
var formidable  = require("formidable");

function _FindOne(KeyValuePair, callback){
	ae.findOne(KeyValuePair, function(err, Detail){
		if(err){
			return callback({Err: err});
		} else {
			if(Detail){
				return callback({Detail: Detail});
			} else {
				return callback({Detail: null});
			}
		}
	});
} /* _FindOne */

function _Update(Object, callback){
	Object.save(function (err, savedDoc){
		return callback({Err: err, SavedDoc: savedDoc});
	});
} /* _Update */

module.exports = class AE {
    constructor(){}

    New(Object, callback){
		_FindOne({'Message': Object.Message, 'Type': Object.Type}, function(Resp){
			if(Resp.Err){
				return callback(Resp);
			}

			if(Resp.Detail){
				let Detail = Resp.Detail;
				Detail.UsersViewed = [];
				Detail.CreateDate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

				_Update(Detail, function(Resp){
					return callback(Resp);
				});
			} else {
				let NewAE = new ae(Object);

				NewAE.save(function (err, savedDoc){
					return callback({Err:err, SavedDoc: savedDoc});
				});
			}
		});
	} /* New */

	Find(KeyValuePair, callback){
		ae.find(KeyValuePair, function(err, DetailArr){
			if(err){
				return callback({Err: err});
			} else {
				if(DetailArr.length > 0){
					return callback({DetailArr: DetailArr});
				} else {
					return callback({DetailArr: null});
				}
			}
		});
	} /* Find */

	FindOne(KeyValuePair, callback){
		_FindOne(KeyValuePair, function(Resp){
			return callback(Resp);
		});
	} /* FindOne */

	Update(Object, callback){
		_Update(Object, function(Resp){
			return callback(Resp);
		});
	} /* Update */

	FormAE(Type, Message){
		let NewAE = {
  			Type: Type,
  			UsersViewed: [],
  			Message: Message,
  			CreateDate: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
		}

		return NewAE;
	} /* FormAE */
}