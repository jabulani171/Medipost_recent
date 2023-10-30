var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var async          = require('async');
var moment 		   = require('moment');
var rest           = require('restler');
var redis          = require('redis');
var exec           = require('child_process').spawn;

var port           = require('../../../config/sysconfig').port;
var HtmlLib	       = require('../../../lib/classHtml');
var dec            = require('../../../lib/declaration');
var paramLib	   = require("../../../lib/classParam");
var LogLib	       = require('../../../lib/classLogging');
var StnLib         = require('../../../lib/classPackingStation');
var BatchHeaderLib = require('../../../lib/classBatchSummary');
var BatchDetailLib = require('../../../lib/classBatchFullDetails');
var TrayLib        = require('../../../lib/classTray');
var classTrayRejectLib        = require('../../../lib/classTrayReject');
var PrinterLib     = require('../../../lib/classPrinter');
const { Console } = require('console');

var router         = express.Router();
var html           = new HtmlLib();
var param 		   = new paramLib();
var log 		   = new LogLib();
var stn            = new StnLib();
var header         = new BatchHeaderLib();
var detail         = new BatchDetailLib();
var tray           = new TrayLib();
var trayReject     = new classTrayRejectLib();
var prn            = new PrinterLib();

PublishClient      = redis.createClient();

function ShowTrayRejectScreen(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('patientBottleReject');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('OperatePatientBottleReject') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowTrayRejectScreen */

router.get('/API/trayreject', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowTrayRejectScreen(null, loggedInUser, req, res);
});

router.post('/API/BottleGetScannedItem', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;
	let ScannedItem = req.body.ScannedItem;

	trayReject.FindOne({'Script_Number':ScannedItem}, function(Resp){
		let Rec = Resp.Rec;
		return res.send(Rec);
	});
});

module.exports = router;