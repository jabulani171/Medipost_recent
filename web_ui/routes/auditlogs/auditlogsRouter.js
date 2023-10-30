var express        = require('express');
var mustache       = require('mustache');
var moment 		   = require('moment')
var formidable     = require("formidable");
var async          = require('async');
var router         = express.Router();

var HtmlLib	       = require('../../../lib/classHtml');
var audiLogLib	   = require('../../../lib/classLogging');


var html           = new HtmlLib();
var audilog		   = new audiLogLib();


function ShowAuditLogList(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('auditlogs');
	let Data = html.GetEmptyPage(loggedInUser);

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowAuditLogList*/

function ShowRolesSetup(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('userAuditLogging');
	let Data = html.GetEmptyPage(loggedInUser);

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowRolesSetup */


//Audit Logs
router.get('/API/auditlogs', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowAuditLogList(null, loggedInUser, req, res);
});

router.post('/API/DTGetAuditLogs', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	audilog.DtGetAuditLogs(req, loggedInUser, function(Resp){
		res.send(Resp);
	});
});


//user transaction 
router.get('/API/rolesSetup', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowRolesSetup(null, loggedInUser, req, res);
});

router.post('/API/DTGetRolesSetup', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	audilog.DtGetRolesSetup(req, loggedInUser, function(Resp){
		res.send(Resp);
	});
});


module.exports = router;
