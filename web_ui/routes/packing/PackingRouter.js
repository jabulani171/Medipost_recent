var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var async          = require('async');
var moment 		   = require('moment');
var rest           = require('restler');
var redis          = require('redis');
var exec           = require('child_process').spawn;

var port           = require('../../../config/sysconfig').port;
var RejectLib      = require('../../../lib/classVerification');
var HtmlLib	       = require('../../../lib/classHtml');
var dec            = require('../../../lib/declaration');
var paramLib	   = require("../../../lib/classParam");
var LogLib	       = require('../../../lib/classLogging');
var StnLib         = require('../../../lib/classPackingStation');
var BatchHeaderLib = require('../../../lib/classBatchSummary');
var BatchDetailLib = require('../../../lib/classBatchFullDetails');
var ShelfLib       = require('../../../lib/classShelf');
var TrayLib        = require('../../../lib/classTray');
var PrinterLib     = require('../../../lib/classPrinter');
const { Console } = require('console');


var router         = express.Router();
var html           = new HtmlLib();
var Reject         = new RejectLib();
var param 		   = new paramLib();
var log 		   = new LogLib();
var stn            = new StnLib();
var header         = new BatchHeaderLib();
var detail         = new BatchDetailLib();
var shelf          = new ShelfLib();
var tray           = new TrayLib();
var prn            = new PrinterLib();


PublishClient      = redis.createClient();



function ShowPackingStationListScreen(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('packingStationList');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ViewPackingStationList') >= 0){
		Data.Granted = true;
	}

	if(req.session.UserPriv.indexOf('ManagePackingStation') >= 0){
		Data.ManagePackingStation = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowPackingStationListScreen */

router.get('/API/packingstationlist', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowPackingStationListScreen(null, loggedInUser, req, res);
});


router.post('/API/DTGetPackingStationList', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	stn.DtGetData(req, loggedInUser, function(Resp){
		res.send(Resp);
	});
});

router.post('/API/addPackingStation', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Packing_Station_IP = req.body.IpAddress;
	let Packing_Station_ID = req.body.StnNo;
	let Label_Printer = req.body.Printer;

	stn.FindOne({'Packing_Station_IP': Packing_Station_IP}, function(Resp){
		if(!Resp.Rec){
			log.WriteUserTrToDB(param, 'ManagePackingStation', Packing_Station_IP, 'Failed To Create New Station ' + Packing_Station_ID + ' Using Ip: ' + Packing_Station_IP + '. Error: Ip Address Already In Use At Station ' + Resp.Rec.Packing_Station_ID, req.session.username);
			return res.send({Err: "Ip Address Already In Use At Different Station"});
		}

		stn.FindOne({'Packing_Station_ID':Packing_Station_ID}, function(Resp){
			if(Resp.Rec){
				log.WriteUserTrToDB(param, 'ManagePackingStation', Packing_Station_ID, 'Failed To Create New Station ' + Packing_Station_ID + ' Using Ip: ' +Packing_Station_IP + '. Error: Stn Number Already In Use', req.session.username);
				return res.send({Err: "Stn Number Already In Use"});
			}

			let NewData = {
                Packing_Station_IP : Packing_Station_IP,
                Packing_Station_ID : Packing_Station_ID,
                Label_Printer   : Label_Printer,
				ActivePatient:null,
                CartonID:null 
			}

			stn.New(NewData, function(Resp){
				log.WriteUserTrToDB(param, 'ManagePackingStation', Label_Printer, 'Successfully Created Station ' +Packing_Station_ID + ' With Ip Address ' +  Packing_Station_IP, req.session.username);
				return res.send({Success: true});
			});
		});
	});
});

router.post('/API/editPackingStation', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Packing_Station_IP = req.body.Packing_Station_IP;
	let Packing_Station_ID = req.body.Packing_Station_ID;
	let Label_Printer = req.body.Label_Printer;

	stn.FindOne({'Packing_Station_ID': Packing_Station_ID}, function(Resp){
		if(Resp.Rec){
			let Record = Resp.Rec;
			let OldVal = Record.Printer;
			let OldIP = Record.Packing_Station_IP;
			let PrinterMod = false;
			let IpMod = false;

			if(OldVal != Printer){
				PrinterMod = true;
				//return res.send({Success: true});
			}

			if(OldIP != Packing_Station_IP){
				IpMod = true;
			}

			Record.Label_Printer = Label_Printer;
			Record.Packing_Station_IP = Packing_Station_IP;
			

			stn.Update(Record, function(Resp){
				if(PrinterMod){
					log.WriteUserTrToDB(param, 'ManagePackingStation',Packing_Station_ID, 'Modified Station ' + Packing_Station_ID + ' Printer from ' + OldVal + ' to ' + Label_Printer, req.session.username);
				}

				if(IpMod){
					log.WriteUserTrToDB(param, 'ManagePackingStation', Packing_Station_ID, 'Modified Station ' + Packing_Station_ID + ' IpAddress from ' + OldIP + ' to ' + Packing_Station_IP, req.session.username);
				}

				return res.send({Success: true});
			});
		}
	});
});

router.get('/API/deletePackingStation', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let DelStn = req.query.stn;

	stn.DeleteRecord({'Packing_Station_ID':DelStn}, function(Resp){
		log.WriteUserTrToDB(param, 'ManagePackingStation', DelStn, 'Successfully Deleted Station ' + DelStn + ' From The System. ', req.session.username);
		res.send({Success: true});

	});
});

module.exports = router;