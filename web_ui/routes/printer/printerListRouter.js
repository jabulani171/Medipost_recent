var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var async          = require('async');
var moment 		   = require('moment');
var redis 	       = require('redis');

var port           = require('../../../config/sysconfig').port;
var BatchSummaryLib = require('../../../lib/classBatchSummary');
var BatchFullDetailLib = require('../../../lib/classBatchFullDetails');
var PackingStationlLib = require('../../../lib/classPackingStation');
var PrinterlLib = require('../../../lib/classPrinter');

var HtmlLib	       = require('../../../lib/classHtml');
var logging	       = require('../../../lib/classLogging');
var dec            = require('../../../lib/declaration');
var paramLib	   = require("../../../lib/classParam");


var router         = express.Router();
var html           = new HtmlLib();
var summary        = new BatchSummaryLib();
var fulldetail     = new BatchFullDetailLib();
var packing     = new PackingStationlLib();
var printer       = new PrinterlLib();

var param 		   = new paramLib();
var log            = new logging();

function ShowPrinterListScreen(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	let StnIP = null;
	frame.ext = html.GetPage('printerList');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ViewPrinterList') >= 0){
		Data.Granted = true;
	}

	if(req.session.UserPriv.indexOf('ManagePrinters') >= 0){
		Data.ManagePrinters = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowPrinterListScreen */

router.get('/API/printerlist', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowPrinterListScreen(null, loggedInUser, req, res);
});


router.post('/API/DTGetPrinterList', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	printer.DtGetData(req, loggedInUser, function(Resp){
		res.send(Resp);
	});
});

router.post('/API/addPrinter', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let PrinterName = req.body.PrinterName;
	let PrinterQueue = req.body.PrinterQueue;
	let Description = req.body.Description;
	let PrinterType = req.body.PrinterType;

	printer.FindOne({'PrinterName': PrinterName}, function(Resp){
		if(Resp.Rec){
			log.WriteUserTrToDB(param, 'ManagePrinters', PrinterName, 'Failed To Create New Printer ' + PrinterName + '. Error: Printer Name Already In Use.', req.session.username);
			return res.send({Err: "Printer Name Already In Use"});
		}

		let NewData = {
			 PrinterName : PrinterName,
			 PrinterQueue : PrinterQueue,
			 Description: Description,
			 PrinterType: PrinterType,
			 CreateDate: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
			 LastUpdate: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
		}

		printer.New(NewData, function(Resp){
			log.WriteUserTrToDB(param, 'ManagePrinters', Resp.SavedDoc.PrinterName, 'Successfully Created Printer ' + Resp.SavedDoc.PrinterName, req.session.username);
			return res.send({Success: true});
		});
	});
});

router.get('/API/deletePrinter', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let PrinterName = req.query.id;

	printer.DeleteRecord({'PrinterName': PrinterName}, function(Resp){
		log.WriteUserTrToDB(param, 'ManagePrinters', PrinterName, 'Successfully Deleted Printer ' + PrinterName + ' From The System. ', req.session.username);
		res.send({Success: true});
	});
});

router.get('/API/getPrinterByType', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let PrinterType = req.query.id;

	printer.Find({'PrinterType': PrinterType}, function(Resp){
		res.send({Success: true, Prn: Resp.Arr});
	});
});

module.exports = router;