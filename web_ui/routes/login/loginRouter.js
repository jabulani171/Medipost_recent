var express        = require('express');
var mustache       = require('mustache');
var moment         = require('moment');
var router         = express.Router();

var ParamLib       = require('../../../lib/classParam');
var HtmlLib	       = require('../../../lib/classHtml');
var UserLib        = require('../../../lib/classUser');

var param          = new ParamLib();
var html           = new HtmlLib();
var user           = new UserLib();

function SetSession(req, UserData, callback){
	req.session.userid = UserData.FirstName;
	req.session.surname = UserData.LastName;
	req.session.username = UserData.UserID;

	let UserPriv = [];
	let UserGroup = UserData.UserGroup;
	

	param.Find({"ParameterName" : "UserGroupSettings", "Fields.GroupName":{$in: UserGroup}}, function(Resp){
		if(Resp.Err){
		}

		if(Resp.Params){
			let x = 0;
			let Params = Resp.Params;
			while(x < Params.length){
				let GroupFunctions = Params[x].Fields.GroupFunctions;
				let y = 0;
				while(y < GroupFunctions.length){
					if(UserPriv.indexOf(GroupFunctions[y]) < 0){
						UserPriv.push(GroupFunctions[y]);
					}
					y++;
				}
				x++;
			}
		}

		req.session.UserPriv = UserPriv;
		req.session.UserGroup = UserData.UserGroup;
		console.log(req.session.UserPriv);

		UserData.LastLogin = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
		user.Update(UserData, function(Resp){
			return callback(Resp.SavedDoc);
		});
	});
} /* SetSession */

function SendResponse(extPage, Data, res){
	let frame = {}
	let page = html.GetPage(null);

	if(!extPage){
		frame.ext = html.GetPage('login');
	} else {
		frame.ext = html.GetPage(extPage);
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* SendResponse */

router.get('/API/login/', function (req, res) {
	let frame = {}
	frame.ext = null;

	let Data = html.GetLoginPage({}, null);

	if(req.session.msg){
		Data.alertMsg = req.session.msg;
		delete req.session.msg;
	}

	let page = html.GetPage('login');
	let htmlpage = mustache.render(page, Data, frame);

	res.send(htmlpage);
});

router.post('/API/logon/', function (req, res) {
	let Data;

	user.GetLoginDetails(req, function(Resp){
		if(!Resp){
			req.session.msg = 'Failed to authenticate user';
			return html.WEB_CallPageRedirect(res, '/API/login/');
		}

		user.FindOne(Resp.Username.toLowerCase(), Resp.Password, true, function(Resp){

			if(Resp.Err){
				req.session.msg = 'Failed to authenticate user';
				return html.WEB_CallPageRedirect(res, '/API/login/');
			}
              
			if(!Resp.User){
				req.session.msg = 'Failed to authenticate user';
				return html.WEB_CallPageRedirect(res, '/API/login/');
			}

			if(Resp.Batch){
				req.session.msg = 'Failed to authenticate user';
				return html.WEB_CallPageRedirect(res, '/API/login/');
			}
			

			SetSession(req, Resp.User, function(Resp){
				return html.WEB_CallPageRedirect(res, '/API/dashboard');
			});
		});
	});
});

router.get('/API/logout', html.requireLogin, function (req, res) {
	delete req.session.userid;
	delete req.session.surname;
	delete req.session.username;

	html.WEB_CallPageRedirect(res, '/API/');
});

module.exports = router;