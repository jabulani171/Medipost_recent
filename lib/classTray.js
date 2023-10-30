var db          = require('../db_schema/tray');
var dec         = require('../lib/declaration');
var moment      = require('moment');

function _CreateRecord(Object, callback){
	let Record = new db(Object);

	Record.save(function (err, savedDoc){
		return callback({Err:err, SavedDoc: savedDoc});
	});
} /* _CreateRecord */

function isString(x) {
  return Object.prototype.toString.call(x) === "[object String]"
}

function escapeRegExp(str) {
    if (!isString(str)) {
        return "";
    }
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function _DtGetDataQuery(req, Query, loggedInUser, callback){
	let searchStr = {};

	let strSearch = req.body['search[value]'];
	let strSort = req.body['order[0][column]'];
	let SortIndex = 'columns['+ strSort +'][data]';
	let SortValue = req.body[SortIndex];
	let strSortDir = req.body['order[0][dir]'];
	let SortDir = -1;

	if(strSortDir == 'asc'){
		SortDir = 1;
	}

	let strSysSort = '{"' + SortValue + '":' + SortDir + '}';
	let SysSort = JSON.parse(strSysSort);

    if(strSearch){
		let regex = new RegExp(escapeRegExp(strSearch), "i");  //new RegExp(strSearch, "i");

		let Filters =  [{'Collection_Point': regex},
						{'Collection_Point_Ref': regex},
						{'Production_Batch': regex},
						{'File_No': regex}];

		if(dec.PatientScriptStatus.get(strSearch)){
			let iStatus = dec.PatientScriptStatus.get(strSearch).value;
			Filters.push({'Status': iStatus});
		}

		searchStr = { $or: Filters};
    }

    let all = {};
    //if(Query){
		searchStr = { $and:[ Query, searchStr ] };
		all = Query;
	//}
    db.countDocuments(all, function (err, c) {
		let recordsTotal=c;
		db.countDocuments(searchStr, function(err, c) {
			let recordsFiltered=c;
			db.find(searchStr, 'Collection_Point Collection_Point_Ref Production_Batch Status File_No',
							   {'skip': Number(req.body.start),
								'limit': Number(req.body.length),
								'sort': SysSort}, function (err, results) {
				if (err) {
					console.log('error while getting results'+err);
					return callback(null);
				}


				let ListData = [];
				let x = 0;
				while(x < results.length){
					let mData = {
						Collection_Point: results[x].Collection_Point,
						Collection_Point_Ref: results[x].Collection_Point_Ref,
						Status: results[x].Status < 0? "" : (dec.PatientScriptStatus.get(results[x].Status).key),
						Production_Batch: results[x].Production_Batch,
						File_No: results[x].File_No
						 
					
					}

					ListData.push(mData);
					x++;
				}

				let data = JSON.stringify({
                    "draw": req.body.draw,
                    "recordsFiltered": recordsFiltered,
                    "recordsTotal": recordsTotal,
                    "data": ListData
				});

				return callback(data);
			});
		});
	});
} /* _DtGetDataQuery */

function _Update(UpdateObject, callback){
	let UpdateS = db(UpdateObject);
	
		UpdateS.save(function(err, savedDoc){
			return callback({Err:err, SavedDoc: savedDoc});
	});
		}/* Update */

module.exports = class Tray {
    constructor(){}

    DtGetDataQuery(req, Query, loggedInUser, callback){
		_DtGetDataQuery(req, Query, loggedInUser, function(Resp){
			return callback(Resp);
		});
	} /* DtGetDataQuery */

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
		_Update(UpdateObject,function (err, savedDoc){
	return callback({Err:err,SavedDoc:savedDoc});
		});
	}

} /* Tray */
