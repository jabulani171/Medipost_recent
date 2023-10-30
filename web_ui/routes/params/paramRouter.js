var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var async          = require('async');
var moment 		   = require('moment');
var redis 	       = require('redis');

var port           = require('../../../config/sysconfig').port;
var BatchSummaryLib = require('../../../lib/classBatchSummary');
var BatchFullDetailLib = require('../../../lib/classBatchFullDetails');
var classParamLib = require('../../../lib/classParam');

var HtmlLib	       = require('../../../lib/classHtml');
var logging	       = require('../../../lib/classLogging');
var dec            = require('../../../lib/declaration');

var router         = express.Router();
var html           = new HtmlLib();
var summary        = new BatchSummaryLib();
var fulldetail     = new BatchFullDetailLib();
var param          = new classParamLib();
var log            = new logging();


function ConvertKeysToFieldNames(keys){
	let Fields = [];
	let x = 0;
	while(x < keys.length){
		Fields.push(keys[x].split(/(?=[A-Z])/).join(" "));
		x++;
	}

	return Fields;
} /* ConvertKeysToFieldNames */

function ShowParams(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('paramList');
	let Data = html.GetEmptyPage(loggedInUser);
	let x = 0;
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

	if(req.session.UserPriv.indexOf('ManageParams') >= 0){
		Data.Granted = true;
	}

	let paramsNameArr = [];
	Data.SelectedParamIndex = -1;
	if(Resp.paramList){
		while(x < Resp.paramList.length){
			if(Resp.paramList[x].ParameterName != 'SystemFunctionSettings' &&
			   Resp.paramList[x].ParameterName != 'UserGroupSettings' &&
			   Resp.paramList[x].ParameterName != 'UserFunctionsSettings' &&
			   Resp.paramList[x].ParameterName != 'SystemProductSettings' &&
			   Resp.paramList[x].ParameterName != 'ScanNotification' &&
			   Resp.paramList[x].ParameterName != 'OpcNodes' &&
			   Resp.paramList[x].ParameterName != 'PrintApplyLines' &&
			   Resp.paramList[x].ParameterName != 'RepeatsDoneSettings'){
				if(req.session.selectedparam && req.session.selectedparam == Resp.paramList[x].ParameterName){
					Data.SelectedParam = Resp.paramList[x].ParamDesc;
					Data.SelectedParamIndex = x;
					delete req.session.selectedparam;
				} else {
					if(Data.SelectedParamIndex == -1 && !req.session.selectedparam){
						Data.SelectedParamIndex = x;
					} else {
						paramsNameArr.push(Resp.paramList[x]);
					}
				}
			}
			x++;
		}

		if(!Data.SelectedParam){
			Data.SelectedParam = Resp.paramList[Data.SelectedParamIndex].ParamDesc;
		}

		let keys = Object.keys(Resp.paramList[Data.SelectedParamIndex].Fields);
		let values = Object.values(Resp.paramList[Data.SelectedParamIndex].Fields);
		let fields = ConvertKeysToFieldNames(keys);

		x = 0;
		let ParamFields = [];
		while(x < keys.length){
			if(keys[x].indexOf('Last') < 0){
				let Obj = {
					Field: fields[x],
					Key: keys[x],
					Value: values[x]
				}

				ParamFields.push(Obj);
			}
			x++;
		}

		Data.ParamFields = ParamFields;
		Data.ID = Resp.paramList[Data.SelectedParamIndex]._id;
		Data.SysParams = paramsNameArr;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowParams */

function ShowDevices(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('device');
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

	if(req.session.UserPriv.indexOf('ManageDevices') >= 0){
		Data.Granted = true;
	}

	if(Resp.printStation){
		let printStation = Resp.printStation;
		Data.Device = printStation;
		let x = 0
		let printerData = Resp.printerArray;
		let printerArr = [];
		while(x < printerData.length){
			printerArr.push({"IPAddr" : printerData[x].printerID});
			x++;
		}

		Data.Device3 = printerArr;
	}

	if(Resp.printerArray){
		Data.Device2 = Resp.printerArray;
	}

	if(req.session.printerData){
		Data.editPrinter = true;
		Data.editPrinterModal = req.session.printerData;
		delete req.session.printerData;
	}

	if(req.session.WorkstationData){
		Data.editWorkStation = true;
		Data.editWorkStation = req.session.WorkstationData;
		delete req.session.WorkstationData;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowDevices */

router.get('/API/systemParameter', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;
	let Stack = {};
	let orderID = req.query.orderID;

	Stack.paramList = function(callback){
		param.Find({}, function (Resp){
			return callback(Resp.Err, Resp.Params);
		});
	}

	async.parallel(Stack, function(err, Result){
		if(err){
			Result.Msg = 'Internal Server Error';
		}

		ShowParams(Result, loggedInUser, req, res);
	});
});

router.get('/API/selectparam', html.requireLogin, function (req, res) {
	let ParamName = req.query.id;

	if(ParamName){
		req.session.selectedparam = ParamName;
	}

	return html.WEB_CallPageRedirect(res, '/API/systemParameter');
});

router.post('/API/addDevice', html.requireLogin, function(req, res){
	let form = new formidable.IncomingForm();
	let deviceType = req.query.id;
	let loggedInUser = req.session.username;

	form.parse(req, function(err, fields, files){
		if(deviceType == "Workstation"){
			printStation.FindOne({"$or" : [{"stationNumber": fields.stationID}, {"stationIP": fields.stationIP}]}, function(Resp){
				if(Resp.printStation){
					req.session.msg = "The station ID already exist, please try again";
					return html.WEB_CallPageRedirect(res, '/API/systemDevice');
				}else{
					console.log(fields.txtipAddress);
					let paramObj = {
						"stationNumber"       : fields.stationID,
						"stationIP"           : fields.stationIP,
						"labelPrinterQName"   : fields.printerName,
						"autobagPrinter"      : fields.txtipAddress,
						"updated_at"          : moment(new Date()).format("YYYY-MM-DD HH:mm"),
						"LastUpdateUser"      : loggedInUser,
						"createdBy" 		  : loggedInUser
					};

					printStation.New(paramObj, function(Resp){
						if(Resp.SavedDoc){
							req.session.msg = "Successfully created a new device";
							log.WriteUserTrToDB(param, 'ManageDevices', "Add Device", 'Successfully added a new workstation : ' + fields.stationIP + '.', req.session.username);
						}else {
							req.session.msg = "Internal server error, please try again" + Resp.Err;
						}

						return html.WEB_CallPageRedirect(res, '/API/systemDevice');
					});
				}
			});
		}else if(deviceType == "Printer"){
			printer.FindOne({"$or" : [{"printerID": fields.printerID}, {"IPAddr" : fields.IPAddr}]}, function(Resp){
				if(Resp.printer){
					req.session.msg = "The station ID already exist, please try again";
					return html.WEB_CallPageRedirect(res, '/API/systemDevice');
				}else{
					let paramObj = {
					  "printerID"      : fields.printerID ,
					  "IPAddr"         : fields.IPAddr,
					  "Active"         : true,
					  "Printer"        : fields.printerName,
					  "LabelConfirmed" : true,
					  "CreateDate"     : moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
					};

					printer.New(paramObj, function(Resp){
						if(Resp.SavedDoc){
							req.session.msg = "Successfully created a new device";
							log.WriteUserTrToDB(param, 'ManageDevices', "Add Device", 'Successfully added new printer : ' + fields.printerID + '.', req.session.username);
						}else {
							req.session.msg = "The station ID already exist, please try again";
						}

						return html.WEB_CallPageRedirect(res, '/API/systemDevice');
					});
				}
			});
		}
	});
});

router.post('/API/updateparameter', html.requireLogin, function (req, res) {
	let id = req.query.id;
	let form = new formidable.IncomingForm();

	form.parse(req, function (err, fields, files){
		param.FindOne({'_id': id}, function (Resp){
			if(Resp.Param){
				let Param = Resp.Param;

				header.Find({$and: [ { 'Status': {$gte: dec.BatchStatus.Assigned.value} }, { 'Status': {$lt: dec.BatchStatus.Shipped.value} } ]}, function(Resp){
					if(Resp.Arr){
						if(Param.ParameterName == 'BagSettings' || Param.ParameterName == 'TraySettings'){
							req.session.msg = 'Cannot update parameter [' + Param.ParamDesc + '] while a batch is in-progress';
							return html.WEB_CallPageRedirect(res, '/API/systemParameter');
						}
					}

					Object.keys(fields).forEach(function(key){
						if(!isNaN(fields[key])){
							fields[key] = parseInt(fields[key]);
						}

						if(fields[key] == 'true'){
							fields[key] = true;
						}

						if(fields[key] == 'false'){
							fields[key] = false;
						}
					});

					let changes = 'Successfully updated values in parameter [' + Param.ParamDesc + '] ';
					let ChangesMade = false;
					let Fields = Param.Fields;
					Object.keys(fields).forEach(function(key){
						Object.keys(Fields).forEach(function(Pkey){
							if(Pkey == key){
								if(fields[key] != Fields[Pkey]){
									ChangesMade = true;
									changes += '| Field [' + key.split(/(?=[A-Z])/).join(" ") + '] from Value [' + Fields[Pkey] + '] to Value [' + fields[key] + '] ';
								}
							}
						});
					});

					if(ChangesMade){
						Param.Fields = fields;
						req.session.selectedparam = Param.ParameterName;
						log.WriteUserTrToDB(param, 'ManageParams', Param.ParamDesc, changes, req.session.username);
						param.Update(Param, function(Resp){
							req.session.msg = 'Successfully updated parameter [' + Param.ParamDesc + ']';
							return html.WEB_CallPageRedirect(res, '/API/systemParameter');
						});
					} else {
						return html.WEB_CallPageRedirect(res, '/API/systemParameter');
					}
				});
			} else {
				return html.WEB_CallPageRedirect(res, '/API/systemParameter');
			}
		});
	});
});

router.get('/API/systemDevice', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;
	let Stack = {};

	/*Stack.printerArray = function(callback){
		printer.Find({}, function(Resp){
			return callback(Resp.Err, Resp.printerArr)
		});
	}
	Stack.printStation = function(callback){
		printStation.Find({}, function(Resp){
			return callback(Resp.Err, Resp.printStationArr)
		});
	}

	async.parallel(Stack, function(err, Resp){
		if(err){
			log.WriteToFile(null, 'Error while compiling data | ERR: ' + err);
			req.session.msg = 'Internal Server Error';
		}

		ShowDevices(Resp, loggedInUser, req, res);
	});*/
});

router.post('/API/updatedevice', html.requireLogin, function (req, res) {
	let id = req.query.id;
	let loggedInUser = req.session.username;
	let form = new formidable.IncomingForm();
	let deviceType = req.query.deviceType;

	form.parse(req, function(err, fields, files){
		if(deviceType == "Printer" ){
			printer.FindOne({"_id" : id}, function(Resp){
				if(Resp.printer){
				 	let printerData = Resp.printer;
					printerData.printerID = fields.printerID;
					printerData.IPAddr = fields.IPAddr;
					printerData.Printer = fields.Printer;
					printerData.LastUpdateUser = loggedInUser;
					printerData.LastUpdate = moment(new Date()).format("YYYY-MM-DD HH:mm");

					printer.Update(printerData, function(Resp){
						if(Resp.SavedDoc){
							req.session.msg = "Successfully updated printer" + fields.printerID;
							log.WriteUserTrToDB(param, 'ManageDevices', "Update Device", 'Successfully modified printer : ' + fields.printerID + '. IP address' +fields.IPAddr, req.session.username);
						}else if(Resp.Err){
							req.session.msg = "Internal server error please try again"
						}

						return html.WEB_CallPageRedirect(res, '/API/systemDevice');
					});
				}
			});
		}else if(deviceType == "Workstation"){
			printStation.FindOne({"_id" : id}, function(Resp){
				if(Resp.printStation){
					let printerData = Resp.printStation;
					printerData.stationNumber = fields.stationID;
					printerData.stationIP = fields.stationIP;
					printerData.autobagPrinter = fields.txtipAddress;
					printerData.LastUpdateUser = loggedInUser;
					printerData.updated_at = moment(new Date()).format("YYYY-MM-DD HH:mm");
					printStation.Update(printerData, function(Resp){
						if(Resp.SavedDoc){
							req.session.msg = "Successfully updated workstation" + fields.stationID;
							log.WriteUserTrToDB(param, 'ManageDevices', "Update Device", 'Successfully modified workstation : ' + fields.stationID + '. IP address' + fields.txtipAddress, req.session.username);
						}else{
							req.session.msg = "Internal server error, please try again"
						}

						return html.WEB_CallPageRedirect(res, '/API/systemDevice');
					});
				}else{
					req.session.msg = "Internal server error please try again"
					return html.WEB_CallPageRedirect(res, '/API/systemDevice');
				}
			});
		}
	});
});

router.get('/API/deleteDevice', html.requireLogin, function (req, res){
	let id = req.query.id;
	let form = new formidable.IncomingForm();
	let deviceType = req.query.deviceType;
	let printerID = req.query.printerID;

	if(deviceType == "Workstation" ){
		printStation.FindOne({"_id" :id}, function(Resp){
			if(Resp.printStation){
				let printStat = Resp.printStation;
				let stationID = printStat.stationID;
				printStat.remove(function(){
					req.session.msg = "Successfully deleted the station";
					log.WriteUserTrToDB(param, 'ManageDevices', "Delete Device", 'Successfully deleted workstation : ' + stationID+ '.', req.session.username);

					return html.WEB_CallPageRedirect(res, '/API/systemDevice');
				});
			}else{
				req.session.msg = "Could not delete station, Internal server error";
				return html.WEB_CallPageRedirect(res, '/API/systemDevice');
			}
		});
	}else if(deviceType == "Printer" ){
		printStation.Find({"autobagPrinter" : printerID}, function(Resp){

			if(Resp.printStationArr != null){
			let x = 0;
				let printerData = Resp.printStationArr;

				while(x < printerData.length){
					printerData[x].autobagPrinter = null;
					let stationNumber = printerData[x].stationNumber;
					printStation.Update(printerData[x], function(Resp){
						if(!Resp.Err){
							log.WriteUserTrToDB(param, 'ManageDevices', "Delete Device", 'Successfully Unassigned workstation [' + stationNumber+ "] From printer :" + printerID, req.session.username);
						}else{
							log.WriteUserTrToDB(param, 'ManageDevices', "Delete Device",Resp.Err, req.session.username);
						}
					});
					x++;
				}
			}
		})
		printer.FindOne({"_id" :id}, function(Resp){
			if(Resp.printer){
				let printers = Resp.printer;
				let printerID = printers.printerID
				printers.remove(function(){
					req.session.msg = "Successfully deleted the printer";
					log.WriteUserTrToDB(param, 'ManageDevices', "Delete Device", 'Successfully deleted printer : ' +printerID+ '.', req.session.username);

					return html.WEB_CallPageRedirect(res, '/API/systemDevice');
				});
			}else{
				req.session.msg = "Could not delete printer, Internal server error";
				return html.WEB_CallPageRedirect(res, '/API/systemDevice');
			}
		});
	}
});
router.post('/API/deleteDevice', html.requireLogin, function (req, res){
	let id = req.query.id;
	let form = new formidable.IncomingForm();
	let deviceType = req.query.deviceType;
	let printerID = req.query.printerID;
	let doneUpdating = false;

	if(deviceType == "Workstation" ){
		printStation.Delete({"_id" :id}, function(Resp){
			if(Resp.SavedDoc){
				req.session.msg = "Successfully deleted the station";
			}else{
				req.session.msg = "Could not delete station, Internal server error";
			}

			return html.WEB_CallPageRedirect(res, '/API/systemDevice');
		});
	}else if(deviceType == "Printer" ){
		printStation.Find({"autobagPrinter" : printerID}, function(Resp){
			if(Resp.printerArr.length > 0){
				let x = 0;
				let printerData = Resp.printerArr;
				while(x < printerData.length){
					printerData[x].autobagPrinter = null;
					printStation.Update(printerData[x], function(Resp){
						if(!Resp.Err){
							log.WriteUserTrToDB(param, 'ManageDevices', "Delete Device", 'Successfully Unassigned [' +printerData[x].stationNumber + "] From printer :" + printerID, req.session.username);
						}else{
							log.WriteUserTrToDB(param, 'ManageDevices', "Delete Device",Resp.Err, req.session.username);
						}
					});
					x++;
				}
			}
		});

		printer.Delete({"_id" :id}, function(Resp){
			if(Resp.SavedDoc){
				req.session.msg = "Successfully deleted the printer";
			}else{
				req.session.msg = "Could not delete printer, Internal server error";
			}

			return html.WEB_CallPageRedirect(res, '/API/systemDevice');
		});
	}
});

router.get('/API/updatedevice', html.requireLogin, function (req, res) {
	let id = req.query.id;
	let form = new formidable.IncomingForm();
	let deviceType = req.query.deviceType;

	if(deviceType == "Printer" ){
		printer.FindOne({"_id" : id}, function(Resp){
			if(Resp.printer){
				req.session.printerData = Resp.printer;
			}else{
				req.session.msg = "Internal server error";
			}

			return html.WEB_CallPageRedirect(res, '/API/systemDevice');
		});
	}else if(deviceType == "Workstation" ){
		printStation.FindOne({"_id" : id}, function(Resp){
			if(Resp.printStation){
				req.session.WorkstationData = Resp.printStation;
			}else{
				req.session.msg = "Internal server error";
			}

			return html.WEB_CallPageRedirect(res, '/API/systemDevice');
		});
	}
});
module.exports = router;