var moment    = require('moment');
var AuditLogs     = require('../db_schema/auditLogs');
var rolesSetup = require('../db_schema/rolesSetup');


function _GetDescFromFunctions(FuncName, Functions){
	let x = 0;
	while(x < Functions.length){
		if(Functions[x].name == FuncName){
			return Functions[x].Description;
		}
		x++;
	}

	return null;
} /* _GetDescFromFunctions */

function _DtGetRolesSetup(req, loggedInUser, callback){
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
		searchStr = { $or: [{'TransactionID':regex },
							{'CreateDate': regex},
							{'UserID': regex },
							{'PluginID': regex},
							{'Log': regex}] };
    }

	rolesSetup.countDocuments({}, function (err, c) {
		let recordsTotal=c;
		rolesSetup.countDocuments(searchStr, function(err, c) {
			let recordsFiltered=c;
			rolesSetup.find(searchStr, 'TransactionID CreateDate UserID PluginID Log',
								{'skip': Number( req.body.start),
								 'limit': Number(req.body.length),
								 'sort': SysSort}, function (err, results) {
				if (err) {
					console.log('error while getting results'+err);
					return callback(null);
				}

				let data = JSON.stringify({
                    "draw": req.body.draw,
                    "recordsFiltered": recordsFiltered,
                    "recordsTotal": recordsTotal,
                    "data": results
				});

				return callback(data);
			});
		});
	});
} /* _DtGetRolesSetup */

function _DtGetAuditLogs(req, loggedInUser, callback){
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
		searchStr = { $or: [{'TransactionID':regex },
							{'CreateDate': regex},
							{'Request': regex },
							{'Response': regex},
							{'Direction': regex},
							{'Status': regex },
							{'PluginID': regex}] };
    }

	AuditLogs.countDocuments({}, function (err, c) {
		let recordsTotal=c;
		AuditLogs.countDocuments(searchStr, function(err, c) {
			let recordsFiltered=c;
			AuditLogs.find(searchStr, 'TransactionID CreateDate Request Response Direction Status PluginID',
								{'skip': Number( req.body.start),
								 'limit': Number(req.body.length),
								 'sort': SysSort}, function (err, results) {
				if (err) {
					console.log('error while getting results'+err);
					return callback(null);
				}

				let data = JSON.stringify({
                    "draw": req.body.draw,
                    "recordsFiltered": recordsFiltered,
                    "recordsTotal": recordsTotal,
                    "data": results
				});

				return callback(data);
			});
		});
	});
} /* _DtGetAuditLogs */

module.exports = class WriteToLog {
    constructor(){}

	WriteToFile(Process, Msg){
		if(Msg){
			console.log(moment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSS') + ' |' + Process + '| ' + Msg);
		}
	} /* WriteToFile */

	WriteTransactionToDB(Key, In, Out, Direction, Status, PluginID, callback){
		let Al = new AuditLogs({
					 TransactionID: Key,
					 Request: In,
					 Response: Out,
					 Direction: Direction,
					 Status: Status,
					 PluginID: PluginID,
					 CreateDate: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')});

		Al.save(function(err, saveDoc){
			if(err){
				console.log(err);
		    }
			return callback(err, saveDoc);
		});
	} /* WriteTransactionToDB */

	WriteUserTrToDB(param, FuncName, Key, Msg, user){
		param.FindOne({'ParameterName':'SystemFunctionSettings'}, function(Resp){
			if(Resp.Err){
				console.log('Failed to query parameters collections. Err: ' + Resp.Err);
				return;
			}

			if(!Resp.Param){
				console.log('Failed to find Functions in parameters ' + FuncName);
				return;
			}

			let Param = Resp.Param;
			let Functions = Param.Fields.Functions;
			let FuncDesc = _GetDescFromFunctions(FuncName, Functions);

			if(!FuncDesc){
				//console.log('Unknown Description For Function ' + FuncName);
				//return;
				FuncDesc = FuncName;
			}

			let roles = new rolesSetup({
						 TransactionID: Key,
						 Log: Msg,
						 PluginID: FuncDesc,
						 UserID: user,
						 CreateDate: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')})

						 roles.save(function(err, saveDoc){
				if(err){
					console.log(err);
				}
				return;
			});
		});
	} /* WriteUserTrToDB */

	FindStream(KeyValuePair){
		let Cursor = AuditLogs.find(KeyValuePair).cursor();

		return Cursor;
	} /* Find */

	FindStreamSort(KeyValuePair, Sort){
		let Cursor = AuditLogs.find(KeyValuePair).sort(Sort).cursor();

		return Cursor;
	} /* FindStreamSort */

	UrFindStream(KeyValuePair){
		let Cursor = rolesSetup.find(KeyValuePair).cursor();

		return Cursor;
	} /* UrFindStream */

	UrFindStreamSort(KeyValuePair, Sort){
		let Cursor = rolesSetup.find(KeyValuePair).sort(Sort).cursor();

		return Cursor;
	} /* UrFindStreamSort */

	Find(KeyValuePair, callback){
		AuditLogs.find(KeyValuePair, function(err, TrArr){
			if(err){
				return callback({Err: err});
			} else {
				if(TrArr.length > 0){
					return callback({TrArr: TrArr});
				} else {
					return callback({TrArr: null});
				}
			}
		});
	} /* Find */

	FindSort(KeyValuePair, Sort, callback){
		AuditLogs.find(KeyValuePair).sort(Sort).exec(function(err, TrArr){
			if(err){
				return callback({Err: err});
			} else {
				if(TrArr.length > 0){
					return callback({TrArr: TrArr});
				} else {
					return callback({TrArr: null});
				}
			}
		});
	} /* FindSort */

	UrTrFind(KeyValuePair, callback){
		rolesSetup.find(KeyValuePair, function(err, TrArr){
			if(err){
				return callback({Err: err});
			} else {
				if(TrArr.length > 0){
					return callback({TrArr: TrArr});
				} else {
					return callback({TrArr: null});
				}
			}
		});
	} /* UrTrFind */

	UrTrFindSort(KeyValuePair, Sort, callback){
		rolesSetup.find(KeyValuePair).sort(Sort).exec(function(err, TrArr){
			if(err){
				return callback({Err: err});
			} else {
				if(TrArr.length > 0){
					return callback({TrArr: TrArr});
				} else {
					return callback({TrArr: null});
				}
			}
		});
	} /* UrTrFindSort */

	FindOne(KeyValuePair, callback){
		AuditLogs.findOne(KeyValuePair, function(err, Tr){
			if(err){
				return callback({Err: err});
			} else {
				if(Tr){
					return callback({Tr: Tr});
				} else {
					return callback({Tr: null});
				}
			}
		});
	} /* FindOne */

    DtGetRolesSetup(req, loggedInUser, callback){
		_DtGetRolesSetup(req, loggedInUser, function(Resp){
			return callback(Resp);
		});
	} /* DtGetRolesSetup */

	DtGetAuditLogs(req, loggedInUser, callback){
		_DtGetAuditLogs(req, loggedInUser, function(Resp){
			return callback(Resp);
		});
	} /* DtGetAuditLogs */
}
