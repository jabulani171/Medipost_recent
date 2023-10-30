var db          = require('../db_schema/printer');
var dec         = require('../lib/declaration');
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

		let Filters = [{'PrinterName': regex},
					   {'PrinterQueue': regex},
					   {'PrinterType': regex},
					   {'Description': regex},
					   {'CreateDate': regex}];

		searchStr = { $or: Filters};
    }

	db.countDocuments({}, function (err, c) {
		let recordsTotal=c;
		db.countDocuments(searchStr, function(err, c) {
			let recordsFiltered=c;
			db.find(searchStr, 'PrinterName PrinterQueue PrinterType Description CreateDate LastUpdate',
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
						PrinterName: results[x].PrinterName,
						PrinterQueue: results[x].PrinterQueue,
						PrinterType: results[x].PrinterType,
						Description: results[x].Description,
						CreateDate: results[x].CreateDate,
						LastUpdate: results[x].LastUpdate,
						CanDelete: req.session.UserPriv.indexOf('ManagePrinters') >= 0? true: false
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

module.exports = class Printer {
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

		UpdateObject.markModified('Cartons');
		UpdateObject.save(function(err, savedDoc){
			return callback({SavedDoc: savedDoc});
		});
	} /* Update */

} /* Printer */