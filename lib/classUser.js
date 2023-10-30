var user        = require('../db_schema/user');
var moment      = require('moment');
var formidable  = require("formidable");

function _DtGetUserManagement(req, loggedInUser, callback){
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
		searchStr = { $or: [{'UserID':regex },{'FirstName': regex},{'LastName': regex }] };
    }

	user.countDocuments({}, function (err, c) {
		let recordsTotal=c;
		user.countDocuments(searchStr, function(err, c) {
			let recordsFiltered=c;
			user.find(searchStr, 'UserID FirstName LastName',
								{'skip': Number( req.body.start),
								 'limit': Number(req.body.length),
								 'sort': SysSort}, function (err, results) {
				if (err) {
					console.log('error while getting results'+err);
					return callback(null);
				}

				let MyData = [];
				let x = 0;
				while(x < results.length){
					let CanDelete = true;
					let CanEdit = true;

					if(results[x].UserID == loggedInUser || results[x].UserID == 'admin'){
						CanDelete = false;
					}

					if(results[x].UserID == 'admin'){
						CanEdit = false;
					}

					let Rec = {
						UserID: results[x].UserID,
						FirstName: results[x].FirstName,
						LastName: results[x].LastName,
						CanDelete: CanDelete,
						CanEdit: CanEdit}

					MyData.push(Rec);
					x++;
				}

				let data = JSON.stringify({
                    "draw": req.body.draw,
                    "recordsFiltered": recordsFiltered,
                    "recordsTotal": recordsTotal,
                    "data": MyData
				});

				return callback(data);
			});
		});
	});
} /* _DtGetUserManagement */

function _CreateUser(Object, callback){
	user.create(Object, function(err, SavedDoc){
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
} /* _CreateUser */

function _ToCamelCase(str){
	return str.toLowerCase().replace(/(?:(^.)|(\s+.))/g, function(match){
		return match.charAt(match.length-1).toUpperCase();
	});
} /* ToCamelCase */

module.exports = class User {
    constructor(){}

    DtGetUserManagement(req, loggedInUser, callback){
		_DtGetUserManagement(req, loggedInUser, function(Resp){
			return callback(Resp);
		});
	} /* DtGetUserManagement */

    New(Object, callback){
		_CreateUser(Object, function(Resp){
			return callback(Resp);
		});
	} /* New */

	DeleteUser(KeyValuePair, callback){
		user.deleteOne(KeyValuePair, function(err, Resp){
			if(err){
				return callback({Err: err})
			}else{
				return callback({DeleteResp: Resp});
			}
		})
	}

	Find(KeyValuePair, callback){
		user.find(KeyValuePair, function(err, UserArr){
			if(err){
				return callback({Err: err});
			} else {
				if(UserArr.length > 0){
					return callback({UserArr: UserArr});
				} else {
					return callback({UserArr: null});
				}
			}
		});
	} /* Find */

	FindOne(UserName, Password, VerifyPwd, callback){


		var KeyValuePair = {'UserID': UserName};

		user.findOne(KeyValuePair, function(err, User){
			if(err){
				return callback({Err: err});
			} else {
				if(User){
					if(VerifyPwd == true){
						User.verifyPassword(Password, function(err, valid){
							if (err) {
								return callback({Err: err});
							} else if (valid) {
								return callback({User: User});
							} else {
								return callback({User: null});
							}
						});
					} else {
						return callback({User: User});
					}
				} else {
					return callback({User: null});
				}
			}
		});
	} /* FindOne */

	FormNewUserObj(req, callback){
		var form = new formidable.IncomingForm();

		form.parse(req, function (err, fields, files){
			if((fields.uid != null) &&
			   (fields.firstName != null) &&
			   (fields.LastName != null) &&
			   (fields.psw != null)){
				   var UserData = {
					     UserID : fields.uid.toLowerCase(),
					     FirstName : _ToCamelCase(fields.firstName),
                         LastName : _ToCamelCase(fields.LastName),
                         Password: fields.psw
				   }

				return callback({UserData: UserData});
			} else {
				return callback({UserData: null});
			}
		});
	} /* FormNewUserObj */

	GetLoginDetails(req, callback){
		var form = new formidable.IncomingForm();

		form.parse(req, function (err, fields, files){
			if((fields.uid != null) &&
			   (fields.uid != "") &&
			   (fields.psw != null) &&
			   (fields.psw != "")){
				return callback({Username: fields.uid, Password: fields.psw});
			} else {
				return callback({Username: null});
			}
		});
	} /* GetLoginDetails */

	ToCamelCase(str){
		return _ToCamelCase(str);
	} /* ToCamelCase */

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