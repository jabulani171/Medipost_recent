var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var async          = require('async');
var moment 		   = require('moment');
var redis 	       = require('redis');

var port           = require('../../../config/sysconfig').port;
var BatchSummaryLib = require('../../../lib/classBatchSummary');
var BatchFullDetailLib = require('../../../lib/classBatchFullDetails');
var HtmlLib	       = require('../../../lib/classHtml');
var logging	       = require('../../../lib/classLogging');
var dec            = require('../../../lib/declaration');
var paramLib	   = require("../../../lib/classParam");

var router         = express.Router();
var html           = new HtmlLib();
var summary        = new BatchSummaryLib();
var fulldetail     = new BatchFullDetailLib();
var param 		   = new paramLib();
var log            = new logging();

PublishClient      = redis.createClient();

function ShowBatchSummary(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('batchSummary');
	let Data = html.GetEmptyPage(loggedInUser);

	Data.Filter = ' ';

	if(req.query.id){
		Data.Filter = req.query.id;
	}

	if(req.session.UserPriv.indexOf('ViewBatch') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowBatchSummary */



function ShowBatchFullDetails(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('batchFullDetails');
	let Data = html.GetEmptyPage(loggedInUser);

	Data.Filter = ' ';

	if(req.query.id){
		Data.Filter = req.query.id;
	}

	if(req.session.UserPriv.indexOf('ViewBatch') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowBatchFullDetails */

function ShowBatchViewScreen(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('batchViewScreen');
	let Data = html.GetEmptyPage(loggedInUser);

	Data.Filter = ' ';

	if(req.query.id){
		Data.Filter = req.query.id;
	}

	if(req.session.UserPriv.indexOf('ViewBatch') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /*  ShowBatchViewScreen */




router.get('/API/batchSummary', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowBatchSummary(null, loggedInUser, req, res);
});

router.get('/API/batchFullDetails', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	ShowBatchFullDetails(null, loggedInUser, req, res);
});


router.post('/API/DTGetBatchFullDetails', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	fulldetail.DtGetData(req, loggedInUser, function(Resp){
		
		res.send(Resp);
	});
});
router.post('/API/DTGetBatchSummary', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	summary.DtGetData(req, loggedInUser, function(Resp){

		res.send(Resp);
	});
});

router.get('/API/startBatch', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Production_Batch = req.query.id;

	summary.FindOne({'Status':dec.BatchStatus.Started.value},function(Resp){
		if(Resp.Rec){
			return res.send({Msg: "Batch Is In Progress Please Finish The Started Batch Before You Can Start Another Batch"});
		}


	summary.FindOne({'Production_Batch': Production_Batch}, function(Resp){
		if(!Resp.Rec){
		return res.send({Msg: "Production_Batch Not Found"});
		}

		let Record = Resp.Rec;
		fulldetail.Find({'Production_Batch': Production_Batch}, function(Resp){
			if(!Resp.Arr){
				return res.send({Msg: "Production_Batch Header Has No Detail"});
			}

				let Arr = Resp.Arr;
				UpdateEachRecordInListToStatus(Arr, 0, dec.PatientScriptStatus.Printed.value, function(){
					Record.Status = dec.BatchStatus.Started.value;

					Record.updated_at = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
					Record.StartUser = req.session.username;
					Record.StartDate = moment(new Date()).format('YYYYMMDD HHmm');
					summary.Update(Record, function(Resp){
						log.WriteUserTrToDB(param, 'ManageBatch', Production_Batch, 'Started Batch ' + Production_Batch, req.session.username);
						res.send({Success: true});
					});
		
				});
				
			
		});
	});
});
});/*Start Batch */


router.get('/API/printBatch', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Production_Batch = req.query.id;

	summary.FindOne({'Production_Batch': Production_Batch}, function(Resp){
		if(!Resp.Rec){
			return res.send({Msg: "Production_Batch Not Found"});
		}

		let Record = Resp.Rec;
		fulldetail.Find({'Production_Batch': Production_Batch}, function(Resp){
			if(!Resp.Arr){
				return res.send({Msg: "Production_Batch Header Has No Detail"});
			}

				let Arr = Resp.Arr;
				Record.Status = dec.BatchStatus.Printing.value;
				UpdateEachRecordInListToStatus(Arr, 0, dec.PatientScriptStatus.Printed.value, function(){
					Record.Status = dec.BatchStatus.Printed.value;

					Record.updated_at = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
					Record.StartUser = req.session.username;
					Record.StartDate = moment(new Date()).format('YYYYMMDD HHmm');
					summary.Update(Record, function(Resp){
						log.WriteUserTrToDB(param, 'ManageBatch', Production_Batch, 'Printed Batch ' + Production_Batch, req.session.username);
						res.send({Success: true});
					});
				});
		});
	});
});/*Print Batch */

function UpdateEachRecordInListToStatus(Arr, ndx, Status, callback){
	if(ndx >= Arr.length){
		return callback();
	}

	let Rec = Arr[ndx];
	Rec.Status = Status;
	Rec.updated_at = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

	fulldetail.Update(Rec, function(Resp){
		ndx++;
		return UpdateEachRecordInListToStatus(Arr, ndx, Status, callback);
	});
} /* UpdateEachRecordInListToStatus */

module.exports = router;

