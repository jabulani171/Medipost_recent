var db          = require('../db_schema/packingStation');
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

		let Filters = [{'Packing_Station_IP': regex},
					   {'Packing_Station_ID': regex},
					   {'Label_Printer': regex},
					   {'ActivePatient': regex},
					   {'CartonID': regex}];

		if(!isNaN(strSearch)){
			Filters.push({'Packing_Station_ID': Number(strSearch)});
		}

		searchStr = { $or: Filters};
    }

	db.countDocuments({}, function (err, c) {
		let recordsTotal=c;
		db.countDocuments(searchStr, function(err, c) {
			let recordsFiltered=c;
			db.find(searchStr, 'Packing_Station_IP Packing_Station_ID Label_Printer ActivePatient CartonID',
							   {'skip': Number( req.body.start),
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
						Packing_Station_IP: results[x].Packing_Station_IP,
						Packing_Station_ID: results[x].Packing_Station_ID,
						Label_Printer: results[x].Label_Printer,
						ActivePatient: results[x].ActivePatient,
						CartonID: results[x].CartonID,
						CanDelete: req.session.UserPriv.indexOf('ManagePackingStation') >= 0? true: false
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

module.exports = class PackingStation {
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

} /* TrayConsolStn */