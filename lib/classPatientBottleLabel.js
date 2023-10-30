var db          = require('../db_schema/batchFullDetails');
var dec         = require('./declaration');
var moment      = require('moment');
   
  
function _DtGetData(req, loggedInUser, callback){
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
		let regex = new RegExp(strSearch, "i");

		let Filters =  [{'Title': regex},
						{'Name': regex},
                        {'Surname': regex},
                        {'ID_Number': regex},
                        {'File_No': regex},
                        {'Collection_Date': regex},
                        {'Next_Collection_Date': regex},
                        {'Client_Name': regex},
                        {'Client_Address': regex},
						{'Parcel_Ref': regex},
						];
						/*
		if(!isNaN(strSearch)){			Filters.push({'MonthSupply': Number(strSearch)});			Filters.push({'ItemNo': Number(strSearch)});			Filters.push({'DispenseQty': Number(strSearch)}); Filters.push({'BagRef': Number(strSearch)});
		}
*/
		if(dec.BatchStatus.get(strSearch)){
			let iStatus = dec.BatchStatus.get(strSearch).value;
			Filters.push({'Status': iStatus});
		}
		searchStr = { $or: Filters};
    }

    let Production_Batch = req.query.id;
    let all = {};
    if(Production_Batch){
		searchStr = { $and:[ {'Production_Batch': Production_Batch}, searchStr ] };
		all = {'Production_Batch': Production_Batch};
	}
    db.countDocuments(all, function (err, c) {
		let recordsTotal=c;
		db.countDocuments(searchStr, function(err, c) {
			let recordsFiltered=c;
			db.find(searchStr, 'Title Name Surname ID_Number File_No Collection_Date Next_Collection_Date Client_Name Client_Address Parcel_Ref',
							   {'skip': Number(req.body.start),
								'limit': Number(req.body.length),
								'sort': SysSort}, function (err, results) {
							
				if (err) {
					console.log('error while getting results'+err);
					return callback(null);
				}

				let ListData = [];
				let x = 0;
				
				x = 0;
				while(x < results.length){
					let mData = {
						 
                        Patient_Name: results[x].Title+" "+ results[x].Name+" "+results[x].Surname,
						ID_Number: results[x].ID_Number,
                        File_No: results[x].File_No,			
						Collection_Date: results[x].Collection_Date,
						Next_Collection_Date:results[x].Next_Collection_Date,
						Client_Name: results[x].Client_Name,
						Client_Address: results[x].Client_Address,
						Parcel_Ref:results[x].Parcel_Ref,
						StatReprint:(req.session.UserPriv.indexOf('ProcessBatch') >= 0? true: false)
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

//change this guy here to reprint
module.exports = class BatchDetail {
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
		if(!UpdateObject){
			return callback({SavedDoc:null});
		}

		UpdateObject.markModified('Fields');
		UpdateObject.save(function(err, savedDoc){
			return callback({SavedDoc: savedDoc});
		});
	} /* Update */

} /* Reprint Cartons */

