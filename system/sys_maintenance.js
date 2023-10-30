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
var RdtLib         = require('../lib/classRdt');
var PrinterLib     = require('../lib/classPrinter');

/* Process Name to be moved to config file. */
var ProcName = 'SYS_MAINTENANCE';

/* Class handlers decl */
var log        = new logging();
var param      = new parameter();
var header     = new BatchHeaderLib();
var detail     = new BatchDetailLib();
var stn        = new StnLib();
var rdt        = new RdtLib();
var prn        = new PrinterLib();

var DBConnected = false;
WaitForTrigger();

function DbConnect(callback){
	DbDisconnect(function(){
		mongoose.connect(config.mongoDB.url, { useNewUrlParser: true });
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

	setTimeout(function(){
		log.WriteToFile(ProcName, 'Checking events... ');
		CheckEvents(function(){
			log.WriteToFile(ProcName, '... Done Checking Events ');
			log.WriteToFile(ProcName, 'Checking EOD... ');
			CheckEOD(function(){
				log.WriteToFile(ProcName, '... Done Checking EOD ');
				return WaitForTrigger();
			});
		});
	}, 60000);
} /* WaitForTrigger */

function ProcessDbBackup(Param, callback){
	let child = exec(Param.Fields.BackupToolPath, ['--archive=' + Param.Fields.DbArchiveName, '--gzip', '--db', Param.Fields.DbName]);

	child.on('close', function(code){
		log.WriteToFile(ProcName, 'DB Backup Created ');

		fs.rename(Param.Fields.DbArchiveName, Param.Fields.DbBackupDir + Param.Fields.DbArchiveName, function(err){
			if(err){
				log.WriteToFile(ProcName, 'DB Backup Move Error: ' + err);
				return callback();
			} else {
				log.WriteToFile(ProcName,'DB Backup file ' + Param.Fields.DbArchiveName + ' is ready for collection in dir ' + Param.Fields.DbBackupDir);

				Param.Fields.BackupDone = true;
				Param.Fields.LastBackupTime = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
				param.Update(Param, function(Resp){
					return callback();
				});
			}
		});
	});

	child.on('error', function(err){
		log.WriteToFile(ProcName, 'DB Backup Error: ' + err);
		return callback();
	});
} /* ProcessDbBackup */

function Diff_Seconds(dt1, dt2){
  var diff =(dt2.getTime() - dt1.getTime()) / 1000;
  diff /= 60;
  return Math.abs(Math.round(diff));
} /* Diff_Seconds */

function RdtEvaluateEach(Arr, index, callback){
	if(index >= Arr.length){
		return callback();
	}

	let Rec = Arr[index];
	let LastUpdate = Rec.LastUpdate;
	let MaxActiveTime = 32;
	let NowDT = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

	let Now = moment(NowDT);
	let LastUpdateDT = moment(LastUpdate);

	let Date1 = Now.utc(true).toDate();
	let Date2 = LastUpdateDT.utc(true).toDate();

	let Diff = Diff_Seconds(Date1, Date2);

        console.log('Diff: ' + Diff);
        console.log('MaxActiveTime: ' + MaxActiveTime);

	if(Diff < MaxActiveTime){
		index++;
		return RdtEvaluateEach(Arr, index, callback);
	}

	Rec.Active = false;
	log.WriteToFile(ProcName, 'RDT ' + Rec.RDTID + ' active time elapsed. RDT set to inactive');
	rdt.Update(Rec, function(Resp){
		index++;
		return RdtEvaluateEach(Arr, index, callback);
	});

} /* RdtEvaluateEach */

function BatchStatusEvaluateEachDetail(BArr, index, callback){
	if(index >= BArr.length){
		return callback();
	}

	let Record = BArr[index];
	detail.Find({'BatchID': Record.BatchID}, function(Resp){
		if(!Resp.Arr){
			index++;
			return BatchStatusEvaluateEachDetail(BArr, index, callback);
		}

		let Arr = Resp.Arr;

		if(!Arr){
			index++;
			return BatchStatusEvaluateEachDetail(BArr, index, callback);
		}

		let x = 0;
		let LowestState = null;
		while(x < Arr.length){
			if(LowestState == null){
					LowestState = Arr[x].Status;
				} else {
					if(Arr[x].Status < LowestState){
							LowestState = Arr[x].Status;
						}
				}
				x++;
		}

		let StrLowestState = dec.PatientScriptStatus.get(LowestState).key;
		let NewStatus = dec.BatchStatus.get(StrLowestState).value;
		let Processed = 0;
		x = 0;
		while(x < Arr.length){
			if(Arr[x].Status == dec.PatientScriptStatus.Shipped.value){
					Processed++;
				}
				x++;
		}

		//if(Record.Status != NewStatus){
		Record.Status = NewStatus;
		Record.LastUpdate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');
		Record.Processed = Processed;

		header.Update(Record, function(Resp){
			index++;
			BatchStatusEvaluateEachDetail(BArr, index, callback);
		});
		return;
			//}

	//index++;
			//BatchStatusEvaluateEachDetail(BArr, index, callback);
	});

} /* BatchStatusEvaluateEachDetail */

function CheckEachDefinedPrinterQueue(CupsQueues, ndx, callback){
	if(ndx >= CupsQueues.length){
		return callback();
	}

	let Queue = CupsQueues[ndx];

	let Child = exec("lpstat", ["-p", Queue]);

	Child.stdout.on('data', (data) => {
		if(!data){
			ndx++;
			return CheckEachDefinedPrinterQueue(CupsQueues, ndx, callback);
		}

		let Response = data.toString();
		if(!Response){
                        ndx++;
                        return CheckEachDefinedPrinterQueue(CupsQueues, ndx, callback);
		}

		let IsDisabled = false;
		if(Response.indexOf("disabled") >= 0){
			IsDisabled = true;
		}

		if(!IsDisabled && Response.indexOf("Paused") >= 0){
			IsDisabled = true;
		}

		if(!IsDisabled){
			ndx++;
			return CheckEachDefinedPrinterQueue(CupsQueues, ndx, callback);
		}

		log.WriteToFile(ProcName, 'Printer Queue: ' + Queue + ' is Disabled. Attempting to Auto re-enable via cups enable command');
		let child1 = exec("cupsenable", [Queue]);

		child1.on('close', function(code){
			ndx++;
			return CheckEachDefinedPrinterQueue(CupsQueues, ndx, callback);
		});
	});

        Child.stderr.on('data', (data) => {
  		//console.error(`child stderr:\n${data}`);
  		if(!data){
			ndx++;
			return CheckEachDefinedPrinterQueue(CupsQueues, ndx, callback);
		}


		let Response = data.toString();
		log.WriteToFile(ProcName, 'Printer Queue: ' + Queue + ' Failure. Err: ' + Response);
		ndx++;
		return CheckEachDefinedPrinterQueue(CupsQueues, ndx, callback);
	});
} /* CheckEachDefinedPrinterQueue */

function ReIndexEachTable(db, DBTables, ndx, callback){
	if(ndx >= DBTables.length){
		return callback();
	}

	let Table = DBTables[ndx];

	db.collection(Table).reIndex(function(finished){
		console.log(finished);
		console.log("finished re indexing " + Table);

		ndx++;
		return ReIndexEachTable(db, DBTables, ndx, callback);
	});
} /* ReIndexEachTable */

function DbOptimiseIndex(callback){
	var MongoClient = require('mongodb').MongoClient;

	MongoClient.connect(config.mongoDB.url, {useNewUrlParser: true,
						keepAlive: 300000,
						connectTimeoutMS: 120000,
						socketTimeoutMS: 1800000
	}, function(err, client) {
		if(err){
			console.log("Database failed to connect - Reason: " + err);
			return callback();
		}

		let db = client.db();

		let DBTables = ["BatchHeader", "BatchDetail", "BatchReference", "BottleCartonPair",
		                "ConsignmentSequence", "PatientFileSequence", "SysAE", "TransactionLog",
		                "Tray", "UserTransactionLog", "Bag"];

		ReIndexEachTable(db, DBTables, 0, function(){
			return callback();
		});
	});
} /* DbOptimiseIndex */

function CheckEvents(callback){
	let Stack = {};

	/*Stack.DbBackupCheck = function(callback){
		let sysDateTimeHour = moment(new Date()).format('HH');
		param.FindOne({'ParameterName': 'DbBackupSettings'}, function(Resp){
			if(Resp.Err){
				log.WriteToFile(ProcName, 'Error while querying parameter collection for DbBackupSettings | Error: ' + Resp.Err);
				return callback();
			}

			if(!Resp.Param){
				log.WriteToFile(ProcName, 'DbBackupSettings parameter not found');
				return callback();
			}

			let Param = Resp.Param;
			let DbBackupHour = Param.Fields.DbBackupHour;
			let BackupDone = Param.Fields.BackupDone;

			if(parseInt(sysDateTimeHour) == DbBackupHour){
				if(!BackupDone){
					ProcessDbBackup(Param, function(){
						return callback(null, null);
					});
				} else {
					return callback(null, null);
				}
			} else {
				Param.Fields.BackupDone = false;
				param.Update(Param, function(Resp){
					return callback(null, null);
				});
			}
		});
	}*/

	Stack.BatchHeaderStatusUpdate = function(callback){
		log.WriteToFile(ProcName, "Checking Active Batches");
		header.Find({$and: [ { 'Status': {$gte: 2} }, { 'Status': {$lt: 8} } ]}, function(Resp){
			if(!Resp.Arr){
				return callback(null, null);
			}

			let Records = Resp.Arr;
			BatchStatusEvaluateEachDetail(Records, 0, function(){
				return callback(null, null);
			});
		});
	}

	Stack.RdtActiveCheck = function(callback){
		log.WriteToFile(ProcName, "Checking Active RDTs");
		rdt.Find({'Active': true}, function(Resp){
			console.log(Resp);
			if(!Resp.RdtArr){
				return callback(null, null);
			}

			let Arr = Resp.RdtArr;
			log.WriteToFile(ProcName, "Found " + Arr.length + " Active RDTs");
			RdtEvaluateEach(Arr, 0, function(){
				return callback(null, null);
			});
		});
	}

	Stack.CheckDisabledPrinters = function(callback){
		let CupsQueues = ['BottlePrintApply_01', 'BottlePrintApply_02', 'RdtDevicePrn_01', 'TrayConsolStnPrn_01'];

		CheckEachDefinedPrinterQueue(CupsQueues, 0, function(){
			return callback(null, null);
		});
	}

	Stack.CheckEOD = function(callback){
		let sysDateTimeHour = moment(new Date()).format('HH');
		param.FindOne({'ParameterName': 'SystemSettings'}, function(Resp){
			if(Resp.Err){
				log.WriteToFile(ProcName, 'Error while querying parameter collection for SystemSettings | Error: ' + Resp.Err);
				return callback();
			}

			if(!Resp.Param){
				log.WriteToFile(ProcName, 'SystemSettings parameter not found');
				return callback();
			}

			let Param = Resp.Param;
			let EndOfDayHour = Param.Fields.EndOfDayHour;
			let EndOfDayDone = Param.Fields.EndOfDayDone;

			if(EndOfDayHour != sysDateTimeHour){
				console.log('EOD: ' + EndOfDayHour + ' != ' + sysDateTimeHour);
				Param.Fields.EndOfDayDone = false;
				Param.markModified('Fields');
				param.Update(Param, function(Resp){
					return callback(null, null);
				});

				return;
			}

			if(EndOfDayDone){
				return callback(null, null);
			}

			DbOptimiseIndex(function(){
				Param.Fields.EndOfDayDone = true;
				Param.markModified('Fields');
				param.Update(Param, function(Resp){
					return callback(null, null);
				});
			});
		});
	}

	async.parallel(Stack, function(err, Result){
		log.WriteToFile(ProcName, "Finished Checking Events");
		return callback();
	});
} /* CheckEvents */

function CheckEOD(callback){
                let sysDateTimeHour = moment(new Date()).format('HH');
                param.FindOne({'ParameterName': 'SystemSettings'}, function(Resp){
                        if(Resp.Err){
                                log.WriteToFile(ProcName, 'Error while querying parameter collection for SystemSettings | Error: ' + Resp.Err);
                                return callback();
                        }

                        if(!Resp.Param){
                                log.WriteToFile(ProcName, 'SystemSettings parameter not found');
                                return callback();
                        }

                        let Param = Resp.Param;
                        let EndOfDayHour = Param.Fields.EndOfDayHour;
                        let EndOfDayDone = Param.Fields.EndOfDayDone;

                        if(EndOfDayHour != sysDateTimeHour){
                                console.log('EOD: ' + EndOfDayHour + ' != ' + sysDateTimeHour);
				if(!EndOfDayDone){
					return callback();
				}

                                Param.Fields.EndOfDayDone = false;
                                Param.markModified('Fields');
                                param.Update(Param, function(Resp){
                                        return callback();
                                });

                                return;
                        }

                        if(EndOfDayDone){
                                return callback();
                        }

                        DbOptimiseIndex(function(){
                                return callback();
                        });
                });
} /* CheckEOD */
