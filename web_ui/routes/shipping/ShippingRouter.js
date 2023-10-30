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
var StnLib         = require('../../../lib/classShippingStation');
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



function ShowShippingStationListScreen(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('shippingStationList');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ViewShippingStationList') >= 0){
		Data.Granted = true;
	}

	if(req.session.UserPriv.indexOf('ManageShippingStation') >= 0){
		Data.ManageShippingStation = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowShippingStationListScreen */

router.get('/API/shippingstationlist', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowShippingStationListScreen(null, loggedInUser, req, res);
});


router.post('/API/DTGetShippingStationList', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	stn.DtGetData(req, loggedInUser, function(Resp){
		res.send(Resp);
	});
});

router.post('/API/addShippingStation', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Shipping_Station_IP = req.body.IpAddress;
	let Shipping_Station_ID = req.body.StnNo;
	let Label_Printer = req.body.Printer;

	stn.FindOne({'Shipping_Station_IP': Shipping_Station_IP}, function(Resp){
		if(Resp.Rec){
			log.WriteUserTrToDB(param, 'ManageShippingStation', Shipping_Station_IP, 'Failed To Create New Station ' + Shipping_Station_ID + ' Using Ip: ' + Shipping_Station_IP + '. Error: Ip Address Already In Use At Station ' + Resp.Rec.Shipping_Station_ID, req.session.username);
			return res.send({Err: "Ip Address Already In Use At Different Station"});
		}

		stn.FindOne({'Shipping_Station_ID':Shipping_Station_ID}, function(Resp){
			if(Resp.Rec){
				log.WriteUserTrToDB(param, 'ManageShippingStation', Shipping_Station_ID, 'Failed To Create New Station ' + Shipping_Station_ID + ' Using Ip: ' +Shipping_Station_IP + '. Error: Stn Number Already In Use', req.session.username);
				return res.send({Err: "Stn Number Already In Use"});
			}

			let NewData = {
                Shipping_Station_IP : Shipping_Station_IP,
                Shipping_Station_ID : Shipping_Station_ID,
                Label_Printer   : Label_Printer,
				ActiveWaybill:null
			}

			stn.New(NewData, function(Resp){
				log.WriteUserTrToDB(param, 'ManageShippingStation', Label_Printer, 'Successfully Created Station ' +Shipping_Station_ID + ' With Ip Address ' +  Shipping_Station_IP, req.session.username);
				return res.send({Success: true});
			});
		});
	});
});

router.post('/API/editShippingStation', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Shipping_Station_IP = req.body.Shipping_Station_IP;
	let Shipping_Station_ID = req.body.Shipping_Station_ID;
	let Label_Printer = req.body.Label_Printer;

	stn.FindOne({'Shipping_Station_ID': Shipping_Station_ID}, function(Resp){
		if(Resp.Rec){
			let Record = Resp.Rec;
			let OldVal = Record.Printer;
			let OldIP = Record.Shipping_Station_IP;
			let PrinterMod = false;
			let IpMod = false;

			if(OldVal != Printer){
				PrinterMod = true;
				//return res.send({Success: true});
			}

			if(OldIP != Shipping_Station_IP){
				IpMod = true;
			}

			Record.Label_Printer = Label_Printer;
			Record.Shipping_Station_IP = Shipping_Station_IP;
			

			stn.Update(Record, function(Resp){
				if(PrinterMod){
					log.WriteUserTrToDB(param, 'ManageShippingStation',Shipping_Station_ID, 'Modified Station ' + Shipping_Station_ID + ' Printer from ' + OldVal + ' to ' + Label_Printer, req.session.username);
				}

				if(IpMod){
					log.WriteUserTrToDB(param, 'ManageShippingStation', Shipping_Station_ID, 'Modified Station ' + Shipping_Station_ID + ' IpAddress from ' + OldIP + ' to ' + Shipping_Station_IP, req.session.username);
				}

				return res.send({Success: true});
			});
		}
	});
});

router.get('/API/deleteShippingStation', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let DelStn = req.query.stn;

	stn.DeleteRecord({'Shipping_Station_ID':DelStn}, function(Resp){
		log.WriteUserTrToDB(param, 'ManageShippingStation', DelStn, 'Successfully Deleted Station ' + DelStn + ' From The System. ', req.session.username);
		res.send({Success: true});

	});
});

module.exports = router;