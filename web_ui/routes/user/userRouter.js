var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var moment 		   = require('moment')
var router         = express.Router();
var parameter      = require('../../../lib/classParam');
var HtmlLib	       = require('../../../lib/classHtml');
var UserLib        = require('../../../lib/classUser');
var LogLib	       = require('../../../lib/classLogging');

var server         = require('../../../config/sysconfig').server_ip;
var port           = require('../../../config/sysconfig').ui_port;

var user           = new UserLib();
var html           = new HtmlLib();
var param          = new parameter();
var log 		   = new LogLib();

function UpdateEachGroup(Params, x, uname, callback){
	if(x >= Params.length){
		return callback();
	}

	Params[x].Fields.LastUpdate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
	Params[x].Fields.LastUpdateUser = uname;
	param.Update(Params[x], function(Resp){
		x++;
		UpdateEachGroup(Params, x, uname, callback);
	});
} /* UpdateEachGroup */

function ShowUsers(Resp, loggedInUser, req, res){
	let frame = {}
	let page = html.GetPage(null);
	frame.ext = html.GetPage('userManagement');

	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ManageUsers') >= 0){
		Data.Granted = true;
	}

	Data.PageUrl = server + ":" + port;

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowUsers */

router.get('/API/userMan', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowUsers(null, loggedInUser, req, res);
});

router.post('/API/addUser', function (req, res) {
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let UserId = req.body.uid;
	let FirstName = req.body.firstname;
	let LastName = req.body.lastname;
	let Password = req.body.psw;

	user.FindOne(UserId, null, false, function(CResp){
		if(CResp.User){
			log.WriteUserTrToDB(param, 'ManageUsers', UserId, 'Failed To Create User ' + UserId + '. Username no unique', req.session.username);
			return res.send({Err: "Username no unique"});
		}

	   let UserData = {
			 UserID : UserId.toLowerCase(),
			 FirstName : user.ToCamelCase(FirstName),
			 LastName : user.ToCamelCase(LastName),
			 Password: Password,
			 CreateDate: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
			 LastUpdate: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
	   }

		user.New(UserData, function(Resp){
			log.WriteUserTrToDB(param, 'ManageUsers', Resp.SavedDoc.UserID, 'User ' + Resp.SavedDoc.UserID + ' created on the system.', req.session.username);
			return res.send({Success: true});
		});
	});
});

router.post('/API/ModifyUser', html.requireLogin, function (req, res) {
	let form = new formidable.IncomingForm();
	let ref = req.headers.referer;
	let refArr = ref.split(port);
	let Msg;

	form.parse(req, function (err, fields, files){
		if((fields.uid != null) &&
		   (fields.Oldpsw != null) &&
		   (fields.Newpsw != null)){
				user.FindOne(fields.uid.toLowerCase(), fields.Oldpsw, true, function(Resp){
					if(Resp.User){
						let User = Resp.User;
						User.Password = fields.Newpsw;

						user.Update(User, function(Resp){
							log.WriteUserTrToDB(param, 'ManageUsers', User.UserID, 'Modified user ' + User.UserID + ' password.', req.session.username);
							Msg = "Successfully changed password";
							req.session.msg = Msg;
							html.WEB_CallPageRedirect(res, refArr[1]);
						});
					} else {
						Msg = "Password change failed - mismatch between old password";
						req.session.msg = Msg;
						html.WEB_CallPageRedirect(res, refArr[1]);
					}
				});
		} else {
			Msg = "Password change failed - Not all fields are populated";
			req.session.msg = Msg;
			html.WEB_CallPageRedirect(res, refArr[1]);
		}
	});
});

router.get('/API/deleteUser', html.requireLogin, function(req, res){
	let id = req.query.id;

	user.FindOne(id, null, false, function(Resp){
		if(!Resp.User){
			return res.send(null);
		}

		let User = Resp.User;
		param.Find({'ParameterName':'UserGroupSettings', 'Fields.UsersInGroup': id}, function(Resp){
			if(Resp.Err){
				return res.send(null);
			}

			if(!Resp.Params){
				log.WriteUserTrToDB(param, 'ManageUsers', User.UserID, 'User ' + User.UserID + ' removed from the system.', req.session.username);
				User.remove(function(){
					return res.send({Success: true});
				});

				return;
			}

			let Params = Resp.Params;
			let x = 0;
			while(x < Params.length){
				let UsersInGroup = Params[x].Fields.UsersInGroup;
				let ndx = UsersInGroup.indexOf(id);
				if(ndx >= 0){
					UsersInGroup.splice(ndx, 1);
				}

				Params[x].Fields.UsersInGroup = UsersInGroup;
				x++;
			}

			UpdateEachGroup(Params, 0, req.session.username, function(){
				log.WriteUserTrToDB(param, 'ManageUsers', User.UserID, 'User ' + User.UserID + ' removed from the system.', req.session.username);
				User.remove(function(){
					return res.send({Success: true});
				});
			});
		});
	});
});

router.post('/API/updateUser', function (req, res) {
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let UserId = req.body.euid;
	let FirstName = req.body.efirstname;
	let LastName = req.body.elastname;
	let Password = req.body.epsw;

	user.FindOne(UserId.toLowerCase(), null, false, function(Resp){
		if(!Resp.User){
			return res.send({Err: "User " + UserId + " Not Found"});
		}

		let User = Resp.User;

		User.Password = Password;
		User.FirstName = user.ToCamelCase(FirstName);
		User.LastName = user.ToCamelCase(LastName);
		User.LastUpdate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
		User.LastUpdateUser = req.session.username;
		log.WriteUserTrToDB(param, 'ManageUsers', User.UserID, 'User ' + User.UserID + ' updated.', req.session.username);
		user.Update(User, function(Resp){
			return res.send({Success: true});
		});
	});
});

function GetSelectedUserFunctions(page, Data, frame, GroupFunctions, GroupUsers, req, res){
	param.FindOne({'ParameterName':'SystemFunctionSettings'}, function(Resp){
		let Param = Resp.Param;
		let x = 0;
		let SysFuncs = Param.Fields.Functions;
		let Functions = [];

		while(x < SysFuncs.length){
			let Checked = 'Checked';
			if(GroupFunctions.indexOf(SysFuncs[x].name) < 0){
				Checked = '';
			}

			let Func = {
				FuncName: SysFuncs[x].name,
				FuncDesc: SysFuncs[x].Description,
				Checked: Checked
			}

			Functions.push(Func);
			x++;
		}

		Data.GroupUsers = GroupUsers;
		Data.GroupFunctions = Functions;

		user.Find({}, function (Resp){
			let UserArr = Resp.UserArr;
			if(UserArr){
				x = 0;
				let AvailUsers = [];
				while(x < UserArr.length){
					if(GroupUsers.indexOf(UserArr[x].UserID) < 0){
						AvailUsers.push(UserArr[x].UserID);
					}
					x++;
				}

				Data.UsersToAdd = AvailUsers;
			}

			let htmlpage = mustache.render(page, Data, frame);
			res.send(htmlpage);
		});
	});
} /* GetSelectedUserFunctions */

function ShowGroupScreen(Resp, loggedInUser, req, res){
	let frame = {}
	let page = html.GetPage(null);
	frame.ext = html.GetPage('groupscreen');
	let Data = html.GetEmptyPage(loggedInUser);

	if(Resp.Err){
		Data.alertMsg = 'Internal Server Error';
	}

	if(Resp.Msg){
		Data.alertMsg = Resp.Msg;
	}

	if(req.session.msg){
		Data.alertMsg = req.session.msg;
		delete req.session.msg;
	}

	if(req.session.UserPriv.indexOf('ManageUsers') >= 0){
		Data.Granted = true;
	}

	let Groups = [];
	let x = 0;
	let selected = null;
	let active = 'active';
	let Expanded = 'true';
	let Color = 'black';
	let Params = Resp.Params;

	while(x < Params.length){
		if(req.session.selectedGroup){
			if(Params[x].Fields.GroupName == req.session.selectedGroup){
				active = 'active';
				Expanded = 'true';
				Color = 'blue';
			} else {
				active = '';
				Expanded = 'false';
				Color = 'black';
			}
		}

		let Group = {
			Active: active,
			Expanded: Expanded,
			Color: Color,
			GroupName: Params[x].Fields.GroupName,
			Url: Params[x].Fields.GroupName
		}

		if(!req.session.selectedGroup){
			if(!selected){
				selected = active;
				active = '';
				req.session.selectedGroup = Params[x].Fields.GroupName;
			}
		}

		Groups.push(Group);
		x++;
	}

	Data.UserGroups = Groups;

	Data.PageUrl = server + ":" + port;

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowGroupScreen */

function UpdateEachUser(UserArr, index, uname, callback){
	if(index >= UserArr.length){
		return callback();
	}

	let User = UserArr[index];
	User.LastUpdate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
	User.LastUpdateUser = uname;
	user.Update(User, function(Resp){
		index++;
		UpdateEachUser(UserArr, index, uname, callback);
	});

} /* UpdateEachUser */

router.get('/API/groupMan', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	param.Find({'ParameterName':'UserGroupSettings'}, function(Resp){
		ShowGroupScreen(Resp, loggedInUser, req, res);
	});
});

router.get('/API/groupManQ', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	let id = req.query.id;
	if(!id){
		return res.send(null);
	}

	param.FindOne({'ParameterName':'UserGroupSettings', 'Fields.GroupName': id}, function(Resp){
		if(!Resp || Resp.Err || !Resp.Param){
			return res.send({Err: 'Failed to retrieve group details'});
		}

		let Group = Resp.Param;
		let GroupFunctions = Group.Fields.GroupFunctions;
		let GroupUsers = Group.Fields.UsersInGroup;

		param.FindOne({'ParameterName':'SystemFunctionSettings'}, function(Resp){
			let Param = Resp.Param;
			let x = 0;
			let SysFuncs = Param.Fields.Functions;
			let Functions = [];

			while(x < SysFuncs.length){
				let Checked = 'Checked';
				if(GroupFunctions.indexOf(SysFuncs[x].name) < 0){
					Checked = '';
				}

				let Func = {
					FuncName: SysFuncs[x].name,
					FuncDesc: SysFuncs[x].Description,
					Checked: Checked
				}

				Functions.push(Func);
				x++;
			}

			user.Find({}, function (Resp){
				let UserArr = Resp.UserArr;
				let AvailUsers = [];
				if(UserArr){
					x = 0;
					while(x < UserArr.length){
						if(GroupUsers.indexOf(UserArr[x].UserID) < 0){
							AvailUsers.push(UserArr[x].UserID);
						}
						x++;
					}
				}

				res.send({Success: true, GroupFunctions: Functions, UsersInGroup: GroupUsers, AvailableUsers: AvailUsers});
			});
		});
	});
});

router.post('/API/groupFuncUpdate', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Function = req.body.Function;
	let Group = req.body.Group;
	let Selected = req.body.Selected;

	param.FindOne({'ParameterName':'UserGroupSettings', 'Fields.GroupName': Group}, function(Resp){
		let Param = Resp.Param;
		if(!Param){
			return res.send({Err: "Group Not Found"});
		}

		let GFs = Param.Fields.GroupFunctions;
		let i = GFs.indexOf(Function);
		let Msg = '';
		if(!Selected){
			if(i >= 0){
				GFs.splice(i, 1);
				Msg = 'Function ' + Function + ' has been removed from User Group ' + Group;
			}
		} else {
			if(i < 0){
				GFs.push(Function);
				Msg = 'Function ' + Function + ' has been added to User Group ' + Group;
			}
		}

		Param.Fields.GroupFunctions = GFs;
		Param.Fields.LastUpdate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
		Param.Fields.LastUpdateUser = req.session.username;
		log.WriteUserTrToDB(param, 'ManageUsers', Group, Msg, req.session.username);

		param.Update(Param, function(Resp){
			return res.send({Success: true});
		});
	});
});

router.post('/API/addutg', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Users = req.body.NewUsers;
	let Group = req.body.Group;

	param.FindOne({'ParameterName':'UserGroupSettings', 'Fields.GroupName': Group}, function(Resp){
		let Param = Resp.Param;
		if(!Param){
			return res.send({Err: "Group Not Found"});
		}

		let x = 0;
		while(x < Users.length){
			if(Param.Fields.UsersInGroup.indexOf(Users[x]) < 0){
				log.WriteUserTrToDB(param, 'ManageUsers', Group, 'User ' + Users[x] + ' added to Group ' + Group, req.session.username);
				Param.Fields.UsersInGroup.push(Users[x]);
			}
			x++;
		}

		Param.Fields.LastUpdate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
		Param.Fields.LastUpdateUser = req.session.username;

		param.Update(Param, function(Resp){
			user.Find({'UserID': {$in: Users}}, function (Resp){
				let UserArr = Resp.UserArr;
				if(!UserArr || UserArr.length <= 0){
					return res.send({Err: "Users Not Found"});
				}

				x = 0
				while(x < UserArr.length){
					let userGrp = UserArr[x].UserGroup;
					if(userGrp.indexOf(Group) < 0){
						userGrp.push(Group);
					}

					UserArr[x].UserGroup = userGrp;
					x++;
				}

				UpdateEachUser(UserArr, 0, req.session.username, function(){
					return res.send({Success: true});
				});
			});
		});
	});
});

router.post('/API/removeufg', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Users = req.body.Users;
	let Group = req.body.Group;

	param.FindOne({'ParameterName':'UserGroupSettings', 'Fields.GroupName': Group}, function(Resp){
		let Param = Resp.Param;
		if(!Param){
			return res.send({Err: "Group Not Found"});
		}

		let x = 0;
		while(x < Users.length){
			let ndx = Param.Fields.UsersInGroup.indexOf(Users[x]);
			if(ndx >= 0){
				log.WriteUserTrToDB(param, 'ManageUsers', Group, 'User ' + Users[x] + ' removed from Group ' + Group, req.session.username);
				Param.Fields.UsersInGroup.splice(ndx, 1);
			}
			x++;
		}

		Param.Fields.LastUpdate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
		Param.Fields.LastUpdateUser = req.session.username;

		param.Update(Param, function(Resp){
			user.Find({'UserID': {$in: Users}}, function (Resp){
				let UserArr = Resp.UserArr;
				if(!UserArr || UserArr.length <= 0){
					return res.send({Err: "Users Not Found"});
				}

				x = 0
				while(x < UserArr.length){
					let userGrp = UserArr[x].UserGroup;
					let dx = userGrp.indexOf(Group);
					if(dx >= 0){
						userGrp.splice(dx, 1);
					}

					UserArr[x].UserGroup = userGrp;
					x++;
				}

				UpdateEachUser(UserArr, 0, req.session.username, function(){
					return res.send({Success: true});
				});
			});
		});
	});
});

router.post('/API/DTGetSysUsers', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	user.DtGetUserManagement(req, loggedInUser, function(Resp){
		res.send(Resp);
	});
});

module.exports = router;