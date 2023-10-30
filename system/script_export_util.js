var mongoose       = require('mongoose');
var async          = require('async');
var moment         = require('moment');
var fs             = require('fs');
var exec           = require('child_process').spawn;
var config         = require('../config/sysconfig');
var logging        = require('../lib/classLogging');
var parameter      = require('../lib/classParam');
var BatchHeaderLib = require('../lib/classBatchHeader');
var BatchDetailLib = require('../lib/classBatchDetail');
var dec            = require('../lib/declaration');
var StnLib         = require('../lib/classTrayConsolStn');

/* Class handlers decl */
var log        = new logging();
var param      = new parameter();
var header     = new BatchHeaderLib();
var detail     = new BatchDetailLib();
var stn        = new StnLib();

var DBConnected = false;
var ProcName = 'UTIL';

WaitForTrigger();

function DbConnect(callback){
	DbDisconnect(function(){
		mongoose.connect(config.mongoDB.url);
		return callback();
	});
} /* DbConnect */

function DbDisconnect(callback){
  	mongoose.connection.close(function (){
		log.WriteToFile(ProcName, 'Cleared DB Link');
		return callback();
  	});
} /* DbDisconnect */

mongoose.connection.on('connected', function () {
	log.WriteToFile(ProcName, 'MongoDB: Connection Established.');
	log.WriteToFile(ProcName, "System Maintenance Service Started");
	DBConnected = true;
});

mongoose.connection.on('error',function (err) {
	log.WriteToFile(ProcName, 'MongoDB: Connection Error: ');
	DBConnected = false;
	return DbDisconnect(function(){});
});

mongoose.connection.on('disconnected', function () {
	log.WriteToFile(ProcName, 'Mongoose default connection disconnected');
	DBConnected = false;
	return DbDisconnect(function(){});
});

function WaitForTrigger(){
	if(!DBConnected){
		setTimeout(function(){
			if(!DBConnected){
				DbConnect(function(){
					return WaitForTrigger();
				});
			} else {
				return WaitForTrigger();
			}
		}, 10000);

		return;
	}

	GetShippedScripts();
} /* WaitForTrigger */

function ProcEachDet(Filename, data, x, callback){
	if(x >= data.length){
		return callback();
	}

	let Rec = data[x];
	let dataToWrite = Rec.BatchID + ',' +
					  Rec.PickupPoint + ',' +
					  Rec.FileNumber + ',' +
					  Rec.ClinicFileNumber + ',' +
					  Rec.AutoNumber + ',' +
					  Rec.PatientName + ',' +
					  Rec.ScriptNo + ',' +
					  Rec.EventDate + ',' +
					  Rec.DueDate + ',' +
					  Rec.CollectionDate + ',' +
					  Rec.ItemNo + ',' +
					  Rec.NSNCode + ',' +
					  Rec.RepeatsDone + ',' +
					  Rec.DispenseQty + ',' +
					  Rec.PatientID + ',' +
					  Rec.CartonID + ',' +
					  Rec.TrayID + ',' +
					  Rec.BatchReference + ',' +
					  Rec.BagNumber + ',' +
					  Rec.ParcelReferenceNo + ',' +
					  Rec.ManifestID + ',' +
					  Rec.ConsignmentReferenceNo + ',' +
					  Rec.DeliveryManifestNo + ',' +
					  Rec.CreateDate + ',' +
					  Rec.DispatchedDate + '\n';

	WriteToCsvFile(Filename, dataToWrite, function(Success){
		if(!Success){
			return callback();
		}

		x++;
		return ProcEachDet(Filename, data, x, callback);
	});
} /* ProcEachDet */

function ProcessHeaderDetails(Filename, Header, callback){
	detail.Find({'BatchID': Header.BatchID, 'Status': dec.PatientScriptStatus.Shipped.value}, function(Resp){
		if(!Resp.Arr){
			log.WriteToFile(ProcName, 'No Detail data found for Header ' + Header.BatchID);
			return callback();
		}

		let data = Resp.Arr;
		ProcEachDet(Filename, data, 0, function(){
			log.WriteToFile(ProcName, 'Processed Header ' + Header.BatchID);
			return callback();
		});
		//csvWriter.writeRecords(data).then(()=>log.WriteToFile(ProcName, 'Shipped scripts processed to csv file'));
	});
} /* ProcessHeaderDetails */

function ProcessEachHeader(Filename, Headers, ndx, callback){
	if(ndx >= Headers.length){
		return callback();
	}

	let Header = Headers[ndx];
	ProcessHeaderDetails(Filename, Header, function(){
		ndx++;
		return ProcessEachHeader(Filename, Headers, ndx, callback);
	});
} /* ProcessEachHeader */

function WriteToCsvFile(Filename, dataToWrite, callback){
	fs.appendFile(Filename, dataToWrite, function (err) {
		let Success = true;
	  	if (err) {
			console.log('Some error occured - file either not saved or corrupted file saved.');
			Success = false;
	  	}

	  	return callback(Success);
	});
} /* WriteToCsvFile */

function GetShippedScripts(){
	header.Find({'Status': dec.BatchStatus.Shipped.value}, function(Resp){
		if(!Resp.Arr){
			log.WriteToFile(ProcName, 'No Header data found');
			return;
		}

		let Headers = Resp.Arr;
		let Filename = 'Out.csv';
		let dataToWrite = 'BatchID,PickupPoint,FileNumber,ClinicFileNumber,AutoNumber,PatientName,ScriptNo,EventDate,DueDate,CollectionDate,ItemNo,NSNCode,RepeatsDone,DispenseQty,PatientID,CartonID,TrayID,BatchReference,BagID,ParcelReferenceNo,ManifestID,ConsignmentReferenceNo,DeliveryManifestNo,CreateDate,DispatchedDate\n';
		WriteToCsvFile(Filename, dataToWrite, function(Success){
			if(!Success){
				return;
			}

			ProcessEachHeader(Filename, Headers, 0, function(){
				log.WriteToFile(ProcName, 'Process Complete.');
			});
		});
	});
} /* GetShippedScripts */





