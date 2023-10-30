var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var async          = require('async');
var moment 		   = require('moment');

var port           = require('../../../config/sysconfig').port;
var BatchSummaryLib = require('../../../lib/classBatchSummary');
var bottlePairLib     = require("../../../lib/classBottlePair")



var HtmlLib	       = require('../../../lib/classHtml');
var dec            = require('../../../lib/declaration');

var router         = express.Router();
var html           = new HtmlLib();
var summary         = new BatchSummaryLib();
var bottlepair     = new bottlePairLib();


function ShowBottlePairDetails(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('batchViewScreen');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ViewBatch') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /*  ShowBottlePairDetails */



router.get('/API/batchViewScreen', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowBottlePairDetails(null, loggedInUser, req, res);
});

router.get('/API/DTGetBatchViewSreen4', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;
 
ProcCartonBottleReq(task,callback);
	
});

router.post('/API/DTGetBatchViewSreen1', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	summary.DtGetData(req, loggedInUser, function(Resp){
		//console.log(Resp);
		res.send(Resp);
	});
});

router.post('/API/DTGetBatchViewSreen2', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	summary.DtGetData(req, loggedInUser, function(Resp){
		//console.log(Resp);
		res.send(Resp);
	});
});

router.post('/API/DTGetBatchViewSreen3', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	bottlepair.DtGetData(req, loggedInUser, function(Resp){
		//console.log(Resp);
		res.send(Resp);
	});
});

router.post('/API/DTGetBatchViewSreen3', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	bottlepair.DtGetData(req, loggedInUser, function(Resp){
		//console.log(Resp);
		res.send(Resp);
	});
});

function ProcCartonBottleReq(task, callback){
	let req = task.req;
	let res = task.res;

	let body = req.body;
	let Line = body.Line;
	let Production_Batch = body.Production_Batch;
	let Carton_ID = null;

	
		Carton_ID = body.Carton_ID;

		bottlepair.FindOne({'Production_Batch': Production_Batch, 'Patient_Name': Patient_Name, 'Status': Status, 'Carton_ID': Carton_ID,'updated_at':updated_at}, function(Resp){
			if(Resp.Err || !Resp.Rec){
				let NewRec = {
					Production_Batch: Production_Batch,
					Patient_Name: Patient_Name,
					Status:dec.PatientScriptStatus.New.value,
					Carton_ID: Carton_ID,
					updated_at: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
				}

				bottlepair.New(NewRec, function(Resp){
					res.status(200).send({Success: true});
					return callback();
				});

				return;
			}

			let Rec = Resp.Rec;
			Rec.Carton_ID = Carton_ID;
			Rec.updated_at = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

			bottlepair.Update(Rec, function(Resp){
				res.status(200).send({Success: true});
				return callback();
			});
		});
} /* ProcCartonBottleReq */

module.exports = router;