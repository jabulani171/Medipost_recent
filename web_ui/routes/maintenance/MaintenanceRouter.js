var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var async          = require('async');
var moment 		   = require('moment');
var redis          = require('redis');

var port           = require('../../../config/sysconfig').port;
var BatchHeaderLib = require('../../../lib/classBatchSummary');
var BatchDetailLib = require('../../../lib/classBatchFullDetails');
var HtmlLib	       = require('../../../lib/classHtml');
var logging	       = require('../../../lib/classLogging');
var dec            = require('../../../lib/declaration');
var paramLib	   = require("../../../lib/classParam");
var verifyLib  	   = require("../../../lib/classVerification");
var TrayLib        = require('../../../lib/classTray');
var PrinterLib     = require('../../../lib/classPrinter');
var ShelfLib       = require('../../../lib/classShelf');


var BottleCartonPairLib    = require('../../../lib/classBottleCartonPair');

var router         = express.Router();
var html           = new HtmlLib();
var header         = new BatchHeaderLib();
var detail         = new BatchDetailLib();
var param 		   = new paramLib();
var log            = new logging();
var verify         = new verifyLib();
var tray           = new TrayLib();
var prn            = new PrinterLib();
var shelf          = new ShelfLib();

var bottlecarton   = new BottleCartonPairLib();

PublishClient              = redis.createClient();

function ShowInprogressBottleList(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('scripts');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ViewScripts') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowInprogressBottleList */

function ShowBottleCartonPairList(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('cartons');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ViewBottleCartonPair') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowBottleCartonPairList */

function ShowTrayList(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('trays');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ViewTrays') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowTrayList */

function ShowShelfList(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('shelves');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ViewShelves') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowShelfList */

function ShowSortPosList(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('sortpos');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ViewSortPos') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowSortPosList */

function ShowBagList(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('bags');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('ViewBags') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowBagList */

function ShowTrayView(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('trayview');
	let Data = html.GetEmptyPage(loggedInUser);

	if(Resp){
		Data.Header = Resp.Header;
		Data.Header.CartonCount = GetCartonCount(Resp.Details);
		Data.Details = Resp.Details;
		Data.Prns = Resp.Prns;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowTrayView */

function GetTrayCount(Details){
	let Parcels = [];
	let x = 0;
	let Arr = Details;
	while(x < Arr.length){
		if(Parcels.indexOf(Arr[x].TrayID) < 0){
			Parcels.push(Arr[x].TrayID);
		}
		x++;
	}

	return Parcels.length;
} /* GetTrayCount */

function GetCartonCount(Details){
	let Parcels = [];
	let x = 0;
	let Arr = Details;
	while(x < Arr.length){
		if(Parcels.indexOf(Arr[x].CartonID) < 0){
			Parcels.push(Arr[x].CartonID);
		}
		x++;
	}

	return Parcels.length;
} /* GetCartonCount */

function ShowBagView(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('bagview');
	let Data = html.GetEmptyPage(loggedInUser);

	if(Resp){
		Data.Header = Resp.Header;
		Data.Header.TrayCount = GetTrayCount(Resp.Details);
		Data.Header.CartonCount = GetCartonCount(Resp.Details);
		Data.Details = Resp.Details;
		Data.Prns = Resp.Prns;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowBagView */

function UpdateEachWithNewCartonID(Arr, index, NewCartonID, Line, callback){
	if(index >= Arr.length){
		return callback();
	}

	let Rec = Arr[index];
	let OldCarton = Rec.CartonID;
	Rec.CartonID = NewCartonID;
	Rec.Line = Line;
	detail.Update(Rec, function(Resp){
		log.WriteToFile('UI', 'Carton Script Label Reprint: Updated Script ' + Rec.ScriptNo + ' CartonID From ' + OldCarton + ' To New CartonID ' + NewCartonID + ' | Line: ' + Line);
		index++;
		return UpdateEachWithNewCartonID(Arr, index, NewCartonID, Line, callback);
	});
} /* UpdateEachWithNewCartonID */

function AddScriptFieldsToData(MyData, index, callback){
	if(index >= MyData.length){
		return callback({NewData: MyData});
	}

	let CartonRec = MyData[index];
	detail.FindOne({'ScriptNo': CartonRec.Bottle1}, function(Resp){
		if(!Resp.Rec){
			index++;
			return AddScriptFieldsToData(MyData, index, callback);
		}

		let ScriptRec = Resp.Rec;

		let NewRec = {
			BatchID: CartonRec.BatchID,
			CartonID: CartonRec.CartonID,
			Bottle1: CartonRec.Bottle1,
			Bottle2: CartonRec.Bottle2,
			Line: CartonRec.Line,
			Processed: CartonRec.Processed,
			Reprint: CartonRec.Reprint,
			CreateDate: CartonRec.CreateDate,
			PatientName: ScriptRec.PatientName,
			PickupPoint: ScriptRec.PickupPoint,
			Status: dec.PatientScriptStatus.get(ScriptRec.Status).key,
			AddReprintBtn: !CartonRec.AddReprintBtn? false: (ScriptRec.Status > dec.PatientScriptStatus.Packed.value? false: true)
		};

		MyData[index] = NewRec;

		index++;
		return AddScriptFieldsToData(MyData, index, callback);
	});
} /* AddScriptFieldsToData */

function PrintTrayManifest(Tray, BatchID, PrinterQueue, loggedInUser, callback){

	let PubData = {
			ManifestType: "clinicmanifest",
			id: Tray,
			landscape: 'l',
			PrinterQueue: PrinterQueue,
			BatchID: BatchID
	}
//console.log(PubData);
	PublishClient.publish('PRINT_MANIFEST', JSON.stringify(PubData), function(){
			log.WriteToFile('UI', 'User ' + loggedInUser + ' reprinted clinic manifest for tray ' + Tray + ' | BatchID: ' + BatchID);
			return callback({Success: true, Msg: 'Successfully printed'});
	});
} /* PrintTrayManifest */

function PrintBagManifest(BagID, BatchID, PrinterQueue, loggedInUser, callback){
	let PubData = {
		ManifestType: "shippingconsignment",
		id: BagID,
		landscape: 'l',
		PrinterQueue: PrinterQueue,
		BatchID: BatchID
	}

	PublishClient.publish('PRINT_MANIFEST', JSON.stringify(PubData), function(){
		log.WriteToFile('UI', 'User ' + loggedInUser + ' reprinted shipping consignment document for bag ' + BagID + ' | BatchID: ' + BatchID);
		let PubData1 = {
			ManifestType: "deliverymanifest",
			id: BagID,
			landscape: 'p',
			PrinterQueue: PrinterQueue,
			BatchID: BatchID,
			NoOfPrints: 2
		}

		PublishClient.publish('PRINT_MANIFEST', JSON.stringify(PubData1), function(){
			log.WriteToFile('UI', 'User ' + loggedInUser + ' reprinted delivery manifest document for bag ' + BagID + ' | BatchID: ' + BatchID);
			return callback({Success: true, Msg: 'Successfully printed'});
		});
	});
} /* PrintBagManifest */

router.get('/API/scripts', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowInprogressBottleList(null, loggedInUser, req, res);
});

router.get('/API/cartons', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowBottleCartonPairList(null, loggedInUser, req, res);
});

router.get('/API/trays', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowTrayList(null, loggedInUser, req, res);
});

router.get('/API/trayDetails', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	let BatchID = req.query.id;
	let TrayID = req.query.tray;

	tray.FindOne({'TrayID': TrayID /*, 'BatchID': BatchID*/}, function(Resp){
		if(!Resp.Rec){
			return html.WEB_CallPageRedirect(res, '/API/trays');
		}

		let HeaderRec = Resp.Rec;
		let NewHeaderRec = {
			PickupPoint: HeaderRec.PickupPoint,
			ScriptGroupNo: HeaderRec.ScriptGroupNo,
			Location: HeaderRec.Location,
			TrayID: HeaderRec.TrayID,
			BatchID: HeaderRec.BatchID,
			BagID: HeaderRec.BagID,
			ManifestID: HeaderRec.ManifestID,
			Status: dec.TrayStatus.get(HeaderRec.Status).key,
			Cartons: HeaderRec.Cartons,
			AddReprintBtn: HeaderRec.Status < dec.TrayStatus.Completed.value? false : (!HeaderRec.ManifestID? false : (req.session.UserPriv.indexOf('ReprintClinicManifest') >= 0? true : false))
		};

		detail.Find({'TrayID': TrayID, 'BatchID': HeaderRec.BatchID}, function(Resp){
			if(!Resp.Arr){
				return html.WEB_CallPageRedirect(res, '/API/trays');
			}

			let DetailArr = Resp.Arr;
			prn.Find({"PrinterType" : "Document Printer"}, function(Resp){
				let PrnArr = Resp.Arr;

				let Obj = {Header: NewHeaderRec, Details: DetailArr, Prns: PrnArr};

				ShowTrayView(Obj, loggedInUser, req, res);
			});
		});
	});
});

router.get('/API/bagDetails', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	let BagID = req.query.id;

	bag.FindOne({'BagID': BagID}, function(Resp){
		if(!Resp.Rec){
			return html.WEB_CallPageRedirect(res, '/API/bags');
		}

		let HeaderRec = Resp.Rec;
		let NewHeaderRec = {
			BagID: HeaderRec.BagID,
			BatchID: HeaderRec.BatchID,
			PickupPoint: HeaderRec.PickupPoint,
			ScriptGroupNo: HeaderRec.ScriptGroupNo,
			BagRef: HeaderRec.BagRef,
			DeliveryManifestNo: HeaderRec.DeliveryManifestNo,
			BatchReference: HeaderRec.BatchReference,
			LastRdt: HeaderRec.LastRdt,
			User: HeaderRec.User,
			CreateDate: HeaderRec.CreateDate,
			AddReprintBtn: req.session.UserPriv.indexOf('ReprintShippingManifests') >= 0? true : false
		};

		detail.Find({'BagNumber': BagID}, function(Resp){
			if(!Resp.Arr){
				return html.WEB_CallPageRedirect(res, '/API/bags');
			}

			let DetailArr = Resp.Arr;
			prn.Find({"PrinterType" : "Document Printer"}, function(Resp){
				let PrnArr = Resp.Arr;

				let Obj = {Header: NewHeaderRec, Details: DetailArr, Prns: PrnArr};

				ShowBagView(Obj, loggedInUser, req, res);
			});
		});
	});
});

router.get('/API/shelves', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowShelfList(null, loggedInUser, req, res);
});

router.get('/API/sortpositions', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowSortPosList(null, loggedInUser, req, res);
});

router.get('/API/bags', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowBagList(null, loggedInUser, req, res);
});

router.post('/API/DTGetShelfList', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	shelf.DtGetDataQuery(req, {}, loggedInUser, function(Resp){

		//console.log(Resp);
		res.send(Resp);
	});
});

router.post('/API/DTGetSortPosList', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	sortpos.DtGetDataQuery(req, {}, loggedInUser, function(Resp){

		//console.log(Resp);
		res.send(Resp);
	});
});

router.post('/API/DTGetScriptList', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;
	let Statuses = [dec.PatientScriptStatus.Started.value, dec.PatientScriptStatus.Labelled.value];

	detail.DtGetDataQuery(req, {'Status': {$in: Statuses}}, loggedInUser, function(Resp){

		//console.log(Resp);
		res.send(Resp);
	});
});

router.post('/API/DTGetCartonPairList', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	bottlecarton.DtGetDataQuery(req, {}, loggedInUser, function(Resp){

		if(Resp){
			let MyDataObj = JSON.parse(Resp);
			let MyData = MyDataObj.data;

			AddScriptFieldsToData(MyData, 0, function(Resp){
				MyDataObj.data = Resp.NewData;

				let RespData = JSON.stringify(MyDataObj);

				//console.log(Resp);
				res.send(RespData);
			});
		} else {
			return res.send({Err: 'Error'});
		}
	});
});

router.post('/API/DTGetTrayList', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	tray.DtGetDataQuery(req, {}, loggedInUser, function(Resp){

		//console.log(Resp);
		res.send(Resp);
	});
});

router.post('/API/DTGetBagList', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	bag.DtGetDataQuery(req, {}, loggedInUser, function(Resp){

		//console.log(Resp);
		res.send(Resp);
	});
});

router.post('/API/scriptReprint', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Msg = '';
	let ScriptNo = req.body.ScriptNo;
	let ProcessLine = parseInt(req.body.ProcessLine);

	verify.ReprintPatientLabel(ScriptNo, ProcessLine, 'UI', function(Resp){
			if(Resp.Msg){
				return res.send({Success: true, Msg: Resp.Msg});
			}

			return res.send({Err: Resp.Err});
	});
});

router.post('/API/cartonPairReprint', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Msg = '';
	let CartonID = req.body.CartonID;
	let NewCartonID = req.body.NewCartonID;
	let Line = parseInt(req.body.Line);

	bottlecarton.FindOne({'CartonID': NewCartonID}, function(Resp){
		if(Resp.Rec){
			return res.send({Err: 'New CartonID ' + NewCartonID + ' Is Not Unique'});
		}

		detail.FindOne({'CartonID': NewCartonID}, function(Resp){
			if(Resp.Rec){
				return res.send({Err: 'New CartonID ' + NewCartonID + ' Is Not Unique'});
			}

			detail.Find({'CartonID': CartonID}, function(Resp){
				if(!Resp.Arr){
					return res.send({Err: 'Original CartonID ' + CartonID + ' Is Not Found On The System'});
				}

				let Arr = Resp.Arr;
				if(Arr[0].Status > dec.PatientScriptStatus.Packed.value){
					return res.send({Err: 'Original CartonID ' + CartonID + ' Is In An Invalid Status - ' + dec.PatientScriptStatus.get(Arr[0].Status).key});
				}

				UpdateEachWithNewCartonID(Arr, 0, NewCartonID, Line, function(Resp){
					bottlecarton.FindOne({'CartonID': CartonID}, function(Resp){
						if(!Resp.Rec){
							return res.send({Err: 'Original CartonID ' + CartonID + ' Is Not Found On The System'});
						}

						let Rec = Resp.Rec;
						let OldCarton = Rec.CartonID;
						Rec.CartonID = NewCartonID;
						Rec.Reprint = true;
						Rec.Line = Line;

						bottlecarton.Update(Rec, function(Resp){
							log.WriteToFile('UI', 'Carton Script Label Reprint: Updated Bottle Carton Pair CartonID From ' + OldCarton + ' To New CartonID ' + NewCartonID + ' | Reprint Set To True | Line: ' + Line);
							return res.send({Success: true, Msg: 'Place New Carton On Line ' + Line + ' And Wait For System To Perform The Reprint'});
						});
					});
				});
			});
		});
	});
});

router.post('/API/clinicManifestReprint', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Msg = '';
	let Tray = req.body.Tray;
	let BatchID = req.body.BatchID;
	let PrinterQueue = req.body.PrinterQueue;

	PrintTrayManifest(Tray, BatchID, PrinterQueue, loggedInUser, function(Resp){
		return res.send(Resp);
	});
});

router.post('/API/BagManifestsReprint', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Msg = '';
	let BagID = req.body.BagID;
	let BatchID = req.body.BatchID;
	let PrinterQueue = req.body.PrinterQueue;

	PrintBagManifest(BagID, BatchID, PrinterQueue, loggedInUser, function(Resp){
		return res.send(Resp);
	});
});

router.post('/API/shelfStatusChange', function (req, res){
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	let Location = req.body.Location;
	let Action = req.body.Action;

console.log(Location + '|' + Action);

	shelf.FindOne({'Shelf': Location}, function(Resp){
		if(!Resp.Rec){
			return res.send({Err: "Shelf Not Found"});
		}

		let Record = Resp.Rec;

console.log(Record);

		if(Record.Tray){
			return res.send({Err: "Cannot Change Status: Shelf Not Empty"});
		}
		
		if(Record.Incoming){
			return res.send({Err: "Cannot Change Status: Shelf Has A Tray Incoming"});
		}

		if(Action == 'activate'){
			Record.Active = true;
			log.WriteToFile('UI', 'User ' + loggedInUser + ' activated shelf ' + Location);
		} else {
			Record.Active = false;
			log.WriteToFile('UI', 'User ' + loggedInUser + ' deactivated shelf ' + Location);
		}

		shelf.Update(Record, function(Resp){
			return res.send({Success: true});
		});
	});
});

module.exports = router;

