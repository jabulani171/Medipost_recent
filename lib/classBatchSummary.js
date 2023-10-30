var db          = require('../db_schema/batchSummary');
var dec         = require('../lib/declaration');
var moment      = require('moment');

function _DtGetData(req, loggedInUser, callback){
	let searchStr = {};

	let strSearch = req.body['search[value]'];
	let strSort = req.body['order[0][column]'];
	let SortIndex = 'columns['+ strSort +'][data]';
	let SortValue = req.body[SortIndex];
	let strSortDir = req.body['order[0][dir]'];
	let SortDir = 1;

	if(strSortDir == 'asc'){
		SortDir = -1;
	}

	let Production_Batch = req.query.id;
	
    let all = {};


    if(Production_Batch){
		searchStr = { $and:[ {'Production_Batch': Production_Batch}, searchStr ] };
		all = {'Production_Batch': Production_Batch};
		
	}

	let strSysSort = '{"' + SortValue + '":' + SortDir + '}';
	let SysSort = JSON.parse(strSysSort);

    if(strSearch){
		let regex = new RegExp(strSearch, "i");

		let Filters = [{'Production_Batch': regex},
					   {'Date_Required': regex},
					   {'created_at': regex},
					   {'updated_at': regex}];

		if(!isNaN(strSearch)){
			Filters.push({'Patients': Number(strSearch)});
			Filters.push({'Processed': Number(strSearch)});
		}
		
		if(dec.BatchStatus.get(strSearch)){
			let iStatus = dec.BatchStatus.get(strSearch).value;
			Filters.push({'Status': iStatus});
		}
		
		searchStr = { $or: Filters};
    }

	db.countDocuments({}, function (err, c) {
		let recordsTotal=c;
		
		db.countDocuments(searchStr, function(err, c) {
			let recordsFiltered=c;
			db.find(searchStr, 'Production_Batch Patients Processed Status Date_Required Status created_at updated_at',
							   {'skip': Number( req.body.start),
								'limit': Number(req.body.length),
								'sort': SysSort}, function (err, results) {
				if (err) {
					console.log('error while getting results'+err);
					return callback(null);
				}

				let ListData = [];
				let x = 0;
				
				let OkToStart = true;
				while(x < results.length){
					if(results[x].Status > dec.BatchStatus.New.value && results[x].Status < dec.BatchStatus.Started.value){
						OkToStart = false;
						break;
					}
					x++;
				}
				x = 0;

				while(x < results.length){
					let mData = {
						Production_Batch: results[x].Production_Batch,
						Patients: results[x].Patients,
						Processed: results[x].Processed,
						Date_Required:results[x].Date_Required,	
						Status:	dec.BatchStatus.get(results[x].Status).key,				
						created_at: results[x].created_at,
						updated_at: results[x].updated_at,
						AddStartBtn: results[x].Status == dec.BatchStatus.New.value ? (req.session.UserPriv.indexOf('ProcessBatch') >= 0? (OkToStart? true: false): false): false
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
} /* _DtGetData */

function _CreateRecord(Object, callback){
	let Record = new db(Object);

	Record.save(function (err, savedDoc){
		return callback({Err:err, SavedDoc: savedDoc});
	});
} /* _CreateRecord */

function _ToCamelCase(str){
	return str.toLowerCase().replace(/(?:(^.)|(\s+.))/g, function(match){
		return match.charAt(match.length-1).toUpperCase();
	});
} /* ToCamelCase */

function _Update(UpdateObject, callback){
let UpdateS = db(UpdateObject);

	UpdateS.save(function(err, savedDoc){
		return callback({Err:err, SavedDoc: savedDoc});
});
	}/* Update */

module.exports = class BatchSummary {
    constructor(){}

    DtGetData(req, loggedInUser, callback){
		_DtGetData(req, loggedInUser, function(Resp){
			return callback(Resp);
		});
	} /* DtGetData */

    New(Object, callback){
		_CreateRecord(Object, function(Resp){
			return callback(Resp);
		});
	} /* New */

	Delete(KeyValuePair, callback){
		db.remove(KeyValuePair, function(err, Resp){
			if(err){
				return callback({Err: err})
			}

			return callback({DeleteResp: Resp});
		});
	} /* Delete */

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

	FormNewRecordObj(Obj, callback){

	} /* FormNewRecordObj */

	ToCamelCase(str){
		return _ToCamelCase(str);
	} /* ToCamelCase */

Update(UpdateObject, callback){
	_Update(UpdateObject,function (err, savedDoc){
return callback({Err:err,SavedDoc:savedDoc});
	});
}

	

} /* BatchSummary */