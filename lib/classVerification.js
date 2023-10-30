var moment                 = require('moment');
var rest                   = require('restler');
var net                    = require('net');
var async            	   = require('async');
var fs                     = require('fs');
var replace                = require('replace');
var redis                  = require('redis');
var exec                   = require('child_process').spawn;
const MaskData             = require('maskdata');

var config                 = require('../config/sysconfig');
var dec                    = require('./declaration');
var ProductLib             = require('./classProduct');
var BatchHeaderLib         = require('./classBatchSummary');
var BatchDetailLib         = require('./classBatchFullDetails');
var ProductRejectLib       = require('./classProductReject');
var EmptyCartonRejectLib   = require('./classEmptyCartonReject');
var PatientScriptRejectLib = require('./classPatientScriptReject');
var BottleRejectLib        = require('./classBottleReject');
var ShipmentRejectLib      = require('./classShipmentReject');
var paramLib	           = require('./classParam');
var pFSeqLib               = require('./classPatientFileSequence');
var TrayLib                = require('./classTray');
var TrayRejectLib          = require('./classTrayReject');
var logging                = require('./classLogging');
var BottleCartonPairLib    = require('./classBottleCartonPair');

var prod                   = new ProductLib();
var header                 = new BatchHeaderLib();
var detail                 = new BatchDetailLib();
var prodReject             = new ProductRejectLib();
var param 		           = new paramLib();
var emptyCartonReject      = new EmptyCartonRejectLib();
var patientScriptReject    = new PatientScriptRejectLib();
var bottleReject           = new BottleRejectLib();
var shipmentReject         = new ShipmentRejectLib();
var patientFileSeq         = new pFSeqLib();
var tray                   = new TrayLib();
var trayReject             = new TrayRejectLib();
var log            	       = new logging();
var bottlecarton           = new BottleCartonPairLib();

var QueueUrl               = config.line_queue_url;

PublishClient              = redis.createClient();

const maskPhoneOptions = {
// Character to mask the data. default value is '*'
maskWith : "*",
// If the starting 'n' digits needs to be unmasked
// Default value is 4
unmaskedStartDigits : 2, //Should be positive Integer
//If the ending 'n' digits needs to be unmasked
// Default value is 1
unmaskedEndDigits : 4 // Should be positive Integer
};

function PublishProductVerifyNotification(ProcName, Line, Reject, ScannedItem, Script){
	let PubData = {
		Line: Line,
		Reject: Reject,
		ScannedItem: ScannedItem,
		Script: Script,
		ScanType: 'ProductVerification'
	}

	PublishClient.publish('PROD_VERIFY_NOTIFY', JSON.stringify(PubData), function(){
		log.WriteToFile(ProcName, 'Published notification [ProductVerification] to subscription [PROD_VERIFY_NOTIFY] | Line: [' + Line + ']');
	});
} /* PublishProductVerifyNotification */

function PublishBottleNotification(ProcName, Line, Reject, ScannedItem){
	let PubData = {
		Line: Line,
		Reject: Reject,
		ScannedItem: ScannedItem,
		ScanType: 'PrintApplyLines'
	}

	PublishClient.publish('BOTTLE_NOTIFY', JSON.stringify(PubData), function(){
		log.WriteToFile(ProcName, 'Published notification [PrintApplyLines] to subscription [BOTTLE_NOTIFY] | Line: [' + Line + ']');
	});
} /* PublishBottleNotification */

function PublishEmptyCartonNotification(ProcName, Line, Reject, ScannedItem){
	let PubData = {
		Line: Line,
		Reject: Reject,
		ScannedItem: ScannedItem,
		ScanType: 'EmptyCartonVerification'
	}

	PublishClient.publish('EMPTY_CARTON_NOTIFY', JSON.stringify(PubData), function(){
		log.WriteToFile(ProcName, 'Published notification [EmptyCartonVerification] to subscription [EMPTY_CARTON_NOTIFY] | Line: [' + Line + ']');
	});
} /* PublishEmptyCartonNotification */

function PublishScriptLabelNotification(ProcName, Line, Reject, ScannedItem){
	let PubData = {
		Line: Line,
		Reject: Reject,
		ScannedItem: ScannedItem,
		ScanType: 'ScriptLabelVerification'
	}

	PublishClient.publish('SCRIPT_LABEL_NOTIFY', JSON.stringify(PubData), function(){
		log.WriteToFile(ProcName, 'Published notification [ScriptLabelVerification] to subscription [SCRIPT_LABEL_NOTIFY] | Line: [' + Line + ']');
	});
} /* PublishScriptLabelNotification */

function PublishDespatchLabelNotification(ProcName, Reject, ScannedItem, ParcelReference){
	let PubData = {
		Reject: Reject,
		ScannedItem: ScannedItem,
		ParcelReference: ParcelReference,
		ScanType: 'DespatchLabelVerification'
	}

	PublishClient.publish('DESPATCH_LABEL_NOTIFY', JSON.stringify(PubData), function(){
		log.WriteToFile(ProcName, 'Published notification [DespatchLabelVerification] to subscription [DESPATCH_LABEL_NOTIFY]');
	});
} /* PublishDespatchLabelNotification */

function PublishShipmentLabelNotification(ProcName, Reject, ScannedItems){
	let PubData = {
		Reject: Reject,
		ScannedItems: ScannedItems,
		ScanType: 'ShipmentLabelVerification'
	}

	PublishClient.publish('SHIPMENT_LABEL_NOTIFY', JSON.stringify(PubData), function(){
		log.WriteToFile(ProcName, 'Published notification [ShipmentLabelVerification] to subscription [SHIPMENT_LABEL_NOTIFY]');
	});
} /* PublishShipmentLabelNotification */

function LabelPrint(IP, Port, Data, TemplateStore, callback){
	let Header = '#041C1E'+ TemplateStore + 'Q0^D';
	let Footer = '??]';

	let DataToSend = Header + Data + Footer;

	let client = new net.Socket();
	let MyResponse = '';
	client.connect(Port, IP, function(err) {
		if(err){
			console.log(moment(new Date()).format('YYYY-MM-DD HH:mm:ss') + ' ' + 'Failed to connect. Err: ' + err);
			return callback({Err: 'Failed to connect to domino printer. IP: ' + IP + ' | Port: ' + Port});
		}

		console.log('Connected');
		client.write(DataToSend);
	});

	client.on('data', function(data) {
		console.log('Received: ' + data);
		MyResponse = data;
		client.destroy(); // kill client after server's response
	});

	client.on('close', function() {
		console.log('Connection closed');
		if(MyResponse.indexOf("0A41D6") >= 0){
			return callback({Success: true});
		} else {
			return callback({Err: 'Printer error -> ' + MyResponse});
		}
	});
} /* LabelPrint */

function WriteProductReject(ScannedItem, BatchID, Reason, callback){
	let NewRej = {
		ProdID  : ScannedItem,
		BatchID : BatchID,
		Reason  : Reason,
		Date    : moment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSS')
	};

	prodReject.New(NewRej, function(Resp){
		return callback();
	});
} /* WriteProductReject */

function WriteBottleReject(ScannedItem, Reason, callback){
	let NewRej = {
		ScriptNo: ScannedItem,
		Reason  : Reason,
		Date    : moment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSS')
	};

	bottleReject.New(NewRej, function(Resp){
		return callback();
	});
} /* WriteBottleReject */

function WriteEmptyCartonReject(ScannedItem, BatchID, Reason, callback){
	let NewRej = {
		CartonID: ScannedItem,
		BatchID : BatchID,
		Reason  : Reason,
		Date    : moment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSS')
	};

	emptyCartonReject.New(NewRej, function(Resp){
		return callback();
	});
} /* WriteEmptyCartonReject */

function WritePatientScriptReject(ScannedCartonID, ScannedPatientScript, BatchID, Reason, callback){
	let NewRej = {
		CartonID     : ScannedCartonID,
		PatientScript: ScannedPatientScript,
		BatchID      : BatchID,
		Reason       : Reason,
		Date         : moment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSS')
	};

	patientScriptReject.New(NewRej, function(Resp){
		return callback();
	});
} /* WritePatientScriptReject */

function WriteShipmentReject(ScannedCartonID, ScannedShipmentID, Reason, callback){
	let NewRej = {
		CartonID     : ScannedCartonID,
		ShipmentID   : ScannedShipmentID,
		Reason       : Reason,
		Date         : moment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSS')
	};

	shipmentReject.New(NewRej, function(Resp){
		return callback();
	});
} /* WriteShipmentReject */

function WriteTrayReject(ScannedTrayID, ScannedManifestID, Reason, callback){
	let NewRej = {
		TrayID       : ScannedTrayID,
		ManifestID   : ScannedManifestID,
		Reason       : Reason,
		Date         : moment(new Date()).format('YYYY-MM-DD HH:mm:ss.SSS')
	};

	trayReject.New(NewRej, function(Resp){
		return callback();
	});
} /* WriteTrayReject */

function SendPrintApplyJob(BatchDetArr, callback){
	param.FindOne({'ParameterName':'PrintApplyLines'}, function(Resp){
		let Param = Resp.Param;
		if(!Param){
			return callback();
		}

		let Patient = Param.Fields.Patient;
		let LastLineUsed = Param.Fields.LastLineUsed;

		if(Param.Fields.BatchID != BatchDetArr[0].BatchID){
			Param.Fields.BatchID = BatchDetArr[0].BatchID;
			Patient = [];
		}

		let LineOne = '';
		let LineTwo = '';
		if(Patient.length > 1){
			LineOne = Patient[0];
			LineTwo = Patient[1];
		} else if(Patient.length > 0){
			LineOne = Patient[0];
		}

		let x = 0;
		let LineToUse = 0;
		while(x < BatchDetArr.length){
			if(BatchDetArr[x].FileNumber == LineOne){
				LineToUse = 1;
				break;
			}

			if(BatchDetArr[x].FileNumber == LineTwo){
				LineToUse = 2;
				break;
			}
			x++;
		}

		if(LineToUse <= 0){
			if(LastLineUsed <= 0){
				LineOne = BatchDetArr[0].FileNumber;
				LastLineUsed = 1;
				LineToUse = 1;
			} else {
				if(LastLineUsed == 1){
					LineTwo = BatchDetArr[0].FileNumber;
					LastLineUsed = 2;
					LineToUse = 2;
				} else {
					LineOne = BatchDetArr[0].FileNumber;
					LastLineUsed = 1;
					LineToUse = 1;
				}
			}
		}

		if(Patient.length <= 0){
			Patient.push(LineOne);
			Patient.push(LineTwo);
		} else {
			if(Patient.length > 1){
				Patient[0] = LineOne;
				Patient[1] = LineTwo;
			} else {
				if(Patient.length > 0){
					Patient[0] = LineOne;
					Patient.push(LineTwo);
				}
			}
		}

		Param.Fields.LastLineUsed = LastLineUsed;
		Param.Fields.Patient = Patient;
		param.Update(Param, function(Resp){
			//WriteJobToQueue
			return callback();
		});
	});
} /* SendPrintApplyJob */

function SendPrintAndApplyPrintJob(Rec, Line, callback){
	let Data = '';

	param.FindOne({'ParameterName':'BottleLabelPrinter', 'Fields.Line': Line}, function(Resp){
		if(!Resp.Param){
			return callback({Err: 'Failed to find BottleLabelPrinter parameter for line ' + Line});
		}

		let Param = Resp.Param;

		let TemplateDir = Param.Fields.TemplateDir;
		let OutputDir = Param.Fields.OutputDir;
		let PrintQueue = Param.Fields.PrintQueue;
		let TemplateName = Param.Fields.Template;

		if(!TemplateDir){
			return callback({Err: 'Datamax print and apply printer: Printer template directory not configured for line ' + Line});
		}

		if(!TemplateName){
			return callback({Err: 'Datamax print and apply printer: Printer template not configured for line ' + Line});
		}

		if(!OutputDir){
			return callback({Err: 'Datamax print and apply printer: Printer output directory not configured for line ' + Line});
		}

		if(!PrintQueue){
			return callback({Err: 'Datamax print and apply printer: Printer queue not configured for line ' + Line});
		}

		let MyDate = moment(new Date()).format('DD-MM-YYYY_HH_mm_ss');
		let Template = TemplateDir + TemplateName;
		let outFile = OutputDir + Rec.ScriptNo + "_" + MyDate + ".prn";

		let Keywords = ['({ScriptNo})',
						'({ScriptNoB})',
					    '({RepeatsDone})',
					    '({PrescribedBy})',
					    '({Directions})',
					    '({Descr1})',
					    '({Descr2})',
					    '({PatientName})',
					    '({CollectionDate})'];

		let ReplaceVals = [];
		let Descr1 = '';
		let Descr2 = '';
		if(Rec.ItemDescription[28] == ' '){
			Descr1 = Rec.ItemDescription.substr(0, 28);
			Descr2 = Rec.ItemDescription.substr(36, Rec.ItemDescription.length -1);
		} else {
			let x = 28 -1;
			let Found = false;
			while(x > 0){
				if(Rec.ItemDescription[x] == ' '){
					Found = true;
					break;
				}
				x--;
			}

			/*if(Found){
				Descr1 = Rec.ItemDescription.substr(0, x);
				Descr2 = Rec.ItemDescription.substr(x, Rec.ItemDescription.length -1);
			} else {
				Descr1 = Rec.ItemDescription.substr(0, 36);
				Descr2 = Rec.ItemDescription.substr(36, Rec.ItemDescription.length -1);
			}*/

			let Rem = 0;
			let RemLen = 0;
			if(Found){
				Rem = Rec.ItemDescription.length - x;
				RemLen = Rem > 28? 28 : Rem;
				Descr1 = Rec.ItemDescription.substr(0, x);
				Descr2 = Rec.ItemDescription.substr(x, RemLen -1);
			} else {
				Rem = Rec.ItemDescription.length - 28;
				RemLen = Rem > 28? 28 : Rem;

				Descr1 = Rec.ItemDescription.substr(0, 28);
				Descr2 = Rec.ItemDescription.substr(28, RemLen -1);
			}
		}

		let MyScript = Rec.ScriptNo;
		//Below required by the 1D DPL barcode
                //let MyArr = MyScript.split('C');
		//let MyValue = MyScript = 'PDC&D' + MyArr[1];
		//Else if we using a QR Code barcode then
                  let MyValue = Rec.ScriptNo;

		ReplaceVals.push(Rec.ScriptNo);
		ReplaceVals.push(MyValue);
		ReplaceVals.push(Rec.RepeatsDone);
		ReplaceVals.push(Rec.PrescribedBy);
		ReplaceVals.push(Rec.Directions);
		ReplaceVals.push(Descr1);
		ReplaceVals.push(Descr2);
		ReplaceVals.push(Rec.PatientName);
		ReplaceVals.push(Rec.CollectionDate);

		fs.copyFile(Template, outFile, (err) => {
			if(err){
				return callback({Err: 'Datamax print and apply printer error: Line ' + Line + ' | Error: ' + err});
			}

			for(let i = 0; i < Keywords.length ; i++){
				replace({
					 regex: Keywords[i],
					 replacement: ReplaceVals[i],
					 paths: [outFile],
					 recursive: true,
					 silent: true
				});
			}

			let child = exec("lpr", ["-P", PrintQueue, "-#1", "-s", "-h", outFile]);

			child.on('close', function(code) {
				return callback({Success: true});
			});

			child.on('error', function(error) {
				return callback({Err: 'Datamax print and apply printer error: Line ' + Line + ' | Failed to print to printer: ' + error});
			});
		});
	});
} /* SendPrintAndApplyPrintJob */

function SendScriptLabelJob(BatchDetArr, Line, callback){
	let Data = '';

	param.FindOne({'ParameterName':'ScriptLabelPrinter', 'Fields.Line': Line}, function(Resp){
		if(!Resp.Param){
			return callback({Err: 'Failed to find ScriptLabelPrinter parameter'});
		}

		let Param = Resp.Param;
		let IP = Param.Fields.PrinterIP;
		let Port = Param.Fields.PrinterPort;

		if(!IP || IP == ''){
			return callback();
		}

		if(!Port || Port < 0){
			return callback();
		}

		detail.Find({'ScriptNo': {$in: BatchDetArr}}, function(Resp){
			if(!Resp.Arr){
				return callback();
			}

			let Arr = Resp.Arr;

			let NexCollDtArr = Arr[0].NextCollectionDates.split(';');
			while(NexCollDtArr.length < 4){
				NexCollDtArr.push(' ');
			}

			let Descr1 = '';
			let Descr2 = '';

			if(Arr[0].ItemDescription[30] == ' '){
				Descr1 = Arr[0].ItemDescription.substr(0, 30);
				Descr2 = Arr[0].ItemDescription.substr(30, Arr[0].ItemDescription.length -1);
			} else {
				let x = 30 -1;
				let Found = false;
				while(x > 0){
					if(Arr[0].ItemDescription[x] == ' '){
						Found = true;
						break;
					}
					x--;
				}

				if(Found){
					Descr1 = Arr[0].ItemDescription.substr(0, x);
					Descr2 = Arr[0].ItemDescription.substr(x, Arr[0].ItemDescription.length -1);
				} else {
					Descr1 = Arr[0].ItemDescription.substr(0, 30);
					Descr2 = Arr[0].ItemDescription.substr(30, Arr[0].ItemDescription.length -1);
				}
			}

			Data = Arr[0].RegistrationProvince + ';';
			Data += Arr[0].FileNumber + ';';
			Data += Arr[0].CollectionDate + ';';
			Data += Arr[0].PatientName + ';';
			Data += Arr[0].Facility + ';';
			Data += Arr[0].PickupPoint + ';';
			Data += Arr[0].SubDistrict + ';';
			Data += Arr[0].District + ';';
			Data += Arr[0].DateOfBirth + ';';

			Data += Arr[0].ScriptGroupNo + ';';
			Data += Arr[0].LabelAddressLine3 + ';';
			Data += Arr[0].LabelSuburb + ';';
			Data += Arr[0].LabelCity + ';';
			Data += Arr[0].LabelProvince + ';';
			Data += Arr[0].LabelPostalCode + ';';
			Data += NexCollDtArr[0] + ';';
			Data += NexCollDtArr[1] + ';';
			Data += NexCollDtArr[2] + ';';
			Data += NexCollDtArr[3] + ';';

			Data += Arr[0].TemplateNo + ';';
			Data += Arr[0].MonthSupply + ';';
			Data += Arr[0].ScriptNo + ';';
			Data += Arr[0].ApprovedBy + ';';

			Data += Arr[0].PrescribedBy + ';';
			Data += Arr[0].ItemNo + ';';
			Data += Arr[0].Directions + ';';
			Data += Descr1 + ';';

			Data += Arr[0].NSNCode + ';';
			Data += Arr[0].ICD10Codes + ';';
			Data += Arr[0].RepeatsDone + ';';
			Data += ((Arr.length > 1)? '2 x ': '1 x ') + Arr[0].DispenseQty + ';';
			Data += Arr[0].ContactNumber + ';';
			Data += Descr2 + ';';
			Data += ((Arr.length > 1)? Arr[1].ScriptNo : ' ');

			let TemplateStore = 1;
			LabelPrint(IP, Port, Data, TemplateStore, function(Resp){
				return callback(Resp);
			});
		});
	});
} /* SendScriptLabelJob */

function SendShipmentLabelPrintJob(Arr, callback){
	let Data = '';

	param.FindOne({'ParameterName':'DispatchLabelPrinter'}, function(Resp){
		if(!Resp.Param){
			return callback({Err: 'Failed to find DispatchLabelPrinter parameter'});
		}

		let Param = Resp.Param;
		let IP = Param.Fields.PrinterIP;
		let Port = Param.Fields.PrinterPort;

		if(!IP || IP == ''){
			return callback();
		}

		if(!Port || Port < 0){
			return callback();
		}

		let Rec = Arr[0];

		let ID = (!Rec.IDNumber)? Rec.PassportNumber : Rec.IDNumber;

		let mID = ID;
                //console.log("IDNr:" + Rec.IDNumber);
                //console.log("PPNr:" + Rec.Passport);
                //console.log("mID pre:" + mID);
		//if(Rec.IDNumber){
			mID = MaskData.maskPhone(ID, maskPhoneOptions);
                //}

                //console.log("mID post:" + mID);

		let DatePrinted = moment(new Date()).format('YYYY/MM/DD HH:mm');
		let NextCollectionDatesArr = Rec.NextCollectionDates.split(';');

		Data = Rec.MonthSupply == 2? 'Medication for Month ' + Rec.MonthSupply + ";" : (Rec.MonthSupply == 7? 'Medication for Month ' + Rec.MonthSupply + ";" : ";");
		Data += Rec.MonthSupply == 3? 'Medication for Month ' + Rec.MonthSupply + ";" : (Rec.MonthSupply == 8? 'Medication for Month ' + Rec.MonthSupply + ";" : ";");
		Data += Rec.MonthSupply == 4? 'Medication for Month ' + Rec.MonthSupply + ";" : (Rec.MonthSupply == 9? 'Medication for Month ' + Rec.MonthSupply + ";" : ";");
		Data += Rec.MonthSupply == 5? 'Medication for Month ' + Rec.MonthSupply + ";" : (Rec.MonthSupply == 10? 'Medication for Month ' + Rec.MonthSupply + ";" : ";");
		Data += Rec.MonthSupply == 2? 'Medication for Month ' + Rec.MonthSupply + ";" : (Rec.MonthSupply == 7? 'Medication for Month ' + Rec.MonthSupply + ";" : ";");
		Data += ";";
		Data += ";";
		Data += Rec.PatientName + ";";
		Data += mID + ";";
		Data += Rec.ClinicFileNumber + ";";
		Data += Rec.LabelAddressLine1 + ";";
		Data += Rec.LabelAddressLine2 + ";";
		Data += Rec.LabelSuburb + ";";
		Data += Rec.LabelAddressLine3 + ";";
		Data += Rec.LabelPostalCode + ";";
		Data += Rec.LabelProvince + ";";
		Data += Rec.LabelCity + ";";
		Data += DatePrinted + ";";
		Data += Rec.RepeatsDone + ";";
		Data += Rec.PatientFirstName[0] + ";";
		Data += Rec.PatientSurname + ";";
		Data += Rec.CollectionDate + ";";
		Data += NextCollectionDatesArr[0] + ";";
		Data += Rec.LabelProvince + ";";
		Data += "001" + ";";
		Data += Rec.ParcelReferenceNo + ";";
		Data += Rec.ScriptGroupNo + ";";
		//Data += Rec.PickupPoint;

		let Descr1 = '';
		let Descr2 = '';

		if(Rec.PickupPoint.length > 24){
			if(Rec.PickupPoint[23] == ' '){
				Descr1 = Rec.PickupPoint.substr(0, 23);
				Descr2 = Rec.PickupPoint.substr(24, Rec.PickupPoint.length -1);
			} else {
				let x = 23 -1;
				let Found = false;
				while(x > 0){
					if(Rec.PickupPoint[x] == ' '){
						Found = true;
						break;
					}
					x--;
				}

				if(Found){
					Descr1 = Rec.PickupPoint.substr(0, x);
					Descr2 = Rec.PickupPoint.substr(x, Rec.PickupPoint.length -1);
				} else {
					Descr1 = Rec.PickupPoint.substr(0, 23);
					Descr2 = Rec.PickupPoint.substr(24, Rec.PickupPoint.length -1);
				}
			}

			Data += Descr1 + ";";
			Data += Descr2;
		} else {
			Data += Rec.PickupPoint + ";";
			Data += "";
		}

		console.log(Data);

		let TemplateStore = 2;
		LabelPrint(IP, Port, Data, TemplateStore, function(Resp){
			return callback(Resp);
		});
	});
} /* SendShipmentLabelPrintJob */

function UpdateEachRecStatus(Arr, ndx, Status, ParcelReferenceNo, callback){
	if(ndx >= Arr.length){
		return callback();
	}

	let Rec = Arr[ndx];
	Rec.Status = Status;
	Rec.ParcelReferenceNo = ParcelReferenceNo;
	Rec.LastUpdate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

	detail.Update(Rec, function(Resp){
		ndx++;
		return UpdateEachRecStatus(Arr, ndx, Status, ParcelReferenceNo, callback);
	});
} /* UpdateEachRecStatus */

function GetPatientFileNextSequenceNum(FileNumber, callback){
	patientFileSeq.FindOne({'FileNumber': FileNumber}, function(Resp){
		let NextNum = 1;
		if(Resp.Rec){
			let Rec = Resp.Rec;

			Rec.SequenceNo++;
			NextNum = Rec.SequenceNo;

			patientFileSeq.Update(Rec, function(Resp){
				return callback({SeqNo: NextNum});
			});

			return;
		}

		let NewRec = {
			FileNumber: FileNumber,
			SequenceNo: NextNum
		}

		patientFileSeq.New(NewRec, function(Resp){
			return callback({SeqNo: NextNum});
		});
	});
} /* GetPatientFileNextSequenceNum */

function UpdateCartonToScripts(ScriptArr, ndx, CartonID, Line, ProcName, callback){
	if(ndx >= ScriptArr.length){
		return callback();
	}

	let ScriptNo = ScriptArr[ndx];
	detail.FindOne({'ScriptNo': ScriptNo}, function(Resp){
		if(Resp.Err || !Resp.Rec){
			ndx++;
			return UpdateCartonToScripts(ScriptArr, ndx, CartonID, Line, ProcName, callback);
		}

		let Rec = Resp.Rec;
		Rec.CartonID = CartonID;
		Rec.LastUpdate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

		detail.Update(Rec, function(Resp){
			log.WriteToFile(ProcName, 'Updated Carton ' + CartonID + ' To Script ' + ScriptNo + ' | Line: ' + Line);
			ndx++;
			return UpdateCartonToScripts(ScriptArr, ndx, CartonID, Line, ProcName, callback);
		});
	});
} /* UpdateCartonToScripts */

function LogPatientScriptRejects(ExistArr, ndx, ScannedCartonID, Reject, BatchID, Line, ProcName, callback){
	if(ndx >= ExistArr.length){
		return callback({Reject: Reject});
	}

	if(ExistArr[ndx].CartonMatch){
		log.WriteToFile(ProcName, 'Script Label Success: ScriptNo ' + ExistArr[ndx].ScriptNo + ' Linked to Carton [' + ScannedCartonID + '] | Line: ' + Line);
		ndx++;
		return LogPatientScriptRejects(ExistArr, ndx, ScannedCartonID, Reject, BatchID, Line, ProcName, callback);
	}

	let ScriptNo = ExistArr[ndx].ScriptNo;
	Reject = true;

	detail.FindOne({'ScriptNo': ScriptNo}, function(Resp){
		if(!Resp.Rec){
			log.WriteToFile(ProcName, 'Script Label Failed: Reason - Patient Script [' + ScriptNo + '] Does Not Exist | Line: ' + Line);

			WritePatientScriptReject(ScannedCartonID,
									 ScriptNo,
									 BatchID,
									 'Patient Script Does Not Exist', function(){
				ndx++;
				return LogPatientScriptRejects(ExistArr, ndx, ScannedCartonID, Reject, BatchID, Line, ProcName, callback);
			});

			return;
		}

		WritePatientScriptReject(ScannedCartonID,
								 ScriptNo,
								 BatchID,
								 'Carton And Patient Script are not linked', function(){
			log.WriteToFile(ProcName, 'Script Label Failed: Reason - ScriptNo [' + ScriptNo + '] Not Linked to Carton [' + ScannedCartonID + '] | Line: ' + Line);

			ndx++;
			return LogPatientScriptRejects(ExistArr, ndx, ScannedCartonID, Reject, BatchID, Line, ProcName, callback);
		});
	});
} /* LogPatientScriptRejects */

function formatted_string(pad, user_str, pad_pos){
	if(typeof user_str === 'undefined')
		return pad;

	if(pad_pos == 'l'){
		return (pad + user_str).slice(-pad.length);
	} else {
		return (user_str + pad).substring(0, pad.length);
    }
} /* formatted_string */

module.exports = class Verify {
    constructor(){}

	/* ==== Product Verification ==== */

	VerifyPLCProductScan(ScannedItem, Line, ProcName, callback){
		let Statuses = [dec.BatchStatus.Assigned.value, dec.BatchStatus.Started.value];
		header.FindOne({'Status': {$in: Statuses}}, function(Resp){
			if(!Resp.Rec){
				log.WriteToFile(ProcName, 'Product Verification Failed: Reason - No active batch on the line | Line: ' + Line);

				PublishProductVerifyNotification(ProcName, Line, true, ScannedItem, '-');

				WriteProductReject(ScannedItem,
				                   'Unknown',
				                   'No active batch on the line', function(){
					return callback({Reject: true});
				});

				return;
			}

			let BatchRec = Resp.Rec;
			prod.FindOne({'EANCode': ScannedItem}, function(Resp){
				if(!Resp.Rec){
					log.WriteToFile(ProcName, 'Product Verification Failed: Reason - Unknown product EAN Code [' + ScannedItem + '] scanned | Line: ' + Line);

					PublishProductVerifyNotification(ProcName, Line, true, ScannedItem, '-');

					WriteProductReject(ScannedItem,
									   BatchRec.BatchID,
									   'Unknown product EAN Code scanned', function(){
						return callback({Reject: true});
					});

					return;
				}

				let ProdRec = Resp.Rec;

				let body = {
					BatchID: BatchRec.BatchID,
					NSNCode: ProdRec.NSNCode,
					Line   : Line
				}

				rest.postJson(QueueUrl, body).on('complete', function(result){
					if(result instanceof Error){
						log.WriteToFile(ProcName, 'Product Verification Failed: Reason - ' + result);

						PublishProductVerifyNotification(ProcName, Line, true, ScannedItem, '-');

						WriteProductReject(ScannedItem,
										   BatchRec.BatchID,
										   'Verification Failed. Err: ' + result, function(){
							return callback({Reject: true});
						});

						return;
					}

					if(result.Err){
						log.WriteToFile(ProcName, 'Product Verification Failed: Reason - ' + result.Err + ' | Line: ' + Line);

						PublishProductVerifyNotification(ProcName, Line, true, ScannedItem, '-');

						WriteProductReject(ScannedItem,
										   BatchRec.BatchID,
										   result.Err, function(){
							return callback({Reject: true});
						});

						return;
					}

					let Rec = result.Rec;
					SendPrintAndApplyPrintJob(Rec, Line, function(Resp){
						if(Resp.Err){
							log.WriteToFile(ProcName, Resp.Err);
							return callback({Reject: true});
						}

						log.WriteToFile(ProcName, 'Product Verification Success: Script ' + Rec.ScriptNo + ' (' + Rec.PatientName + ')' + ' Status Changed To ' + dec.PatientScriptStatus.get(Rec.Status).key + ' | Line: ' + Line);

						PublishProductVerifyNotification(ProcName, Line, false, ScannedItem, Rec.ScriptNo);

						return callback({Reject: false});
					});
				});
			});
		});
	} /* VerifyPLCProductScan */

	ProductRejectStnScan(ScannedItem, callback){
		prodReject.Find({'ProdID': ScannedItem}, function(Resp){
			if(!Resp.Arr){
				return callback({ErrMsg: 'Scanned item not found in reject list'});
			}

			let Arr = Resp.Arr;
			let Rec = Arr[Arr.length -1];
			return callback({Rec: Rec});
		});
	} /* ProductRejectStnScan */

	/* ====	Bottle Verification ==== */

	VerifyPLCBottleScan(ScannedItem, Line, ProcName, callback){
		let Stack = {};

		Stack.HeldPostion = function(callback){
			param.FindOne({'ParameterName':'PrintApplyLines', 'Fields.Line': Line}, function(Resp){
				return callback(Resp.Err, Resp.Param);
			});
		}

		Stack.ScriptRec = function(callback){
			detail.FindOne({'ScriptNo': ScannedItem}, function(Resp){
				return callback(Resp.Err, Resp.Rec);
			});
		}

		async.parallel(Stack, function(err, Result){
			if(err){
				log.WriteToFile(ProcName, 'Bottle Script No Barcode Scan Failed: Reason - ' + err + ' | Line: ' + Line);
				PublishBottleNotification(ProcName, Line, true, ScannedItem);
				return callback({Reject: true});
			}

			let Param = Result.HeldPostion;
			let Rec = Result.ScriptRec;

			if(!ScannedItem){
				log.WriteToFile(ProcName, 'Bottle Script No Barcode Scan Failed: Reason - no value received' + ' | Line: ' + Line);
				PublishBottleNotification(ProcName, Line, true, '-');

				WriteBottleReject(Param.Fields.ScriptNo,
				                  'NoRead value received from PLC :- Clearing the held position | Line: ' + Line,
				                  function(){});

				Param.Fields.ScriptNo = '';
				Param.Fields.PatientId = '';

				param.Update(Param, function(Resp){});

				return callback({Reject: true, RejectValue: 3});
			}

			if(ScannedItem.trim().toUpperCase().indexOf('NoRead'.toUpperCase()) >= 0){
				log.WriteToFile(ProcName, 'Bottle Script No Barcode Scan Failed: Reason - [NoRead] value received' + ' | Line: ' + Line);
				PublishBottleNotification(ProcName, Line, true, ScannedItem);

				WriteBottleReject(Param.Fields.ScriptNo,
				                  'NoRead value received from PLC :- Clearing the held position | Line: ' + Line,
				                  function(){});

				Param.Fields.ScriptNo = '';
				Param.Fields.PatientId = '';

				param.Update(Param, function(Resp){});

				return callback({Reject: true, RejectValue: 3});
			}

			if(!Rec){
				log.WriteToFile(ProcName, 'Bottle Script No Barcode Scan Failed: Reason - Barcode [' + ScannedItem + '] doesn�t match any patient in batch runs associated with the line | Line: ' + Line);
				PublishBottleNotification(ProcName, Line, true, ScannedItem);

				WriteBottleReject(ScannedItem,
				                  'Barcode doesn�t match any patient in batch runs associated with the line | Line: ' + Line,
				                  function(){});

				return callback({Reject: true});
			}

			if(Rec.Status < dec.PatientScriptStatus.Labelled.value){
				Rec.Status = dec.PatientScriptStatus.Labelled.value;
				Rec.LastUpdate = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

				detail.Update(Rec, function(Resp){
					let MyRec = Resp.SavedDoc;
					if(MyRec){
						log.WriteToFile(ProcName, 'Bottle Script No Barcode Scan: Script ' + MyRec.ScriptNo + ' (' + MyRec.PatientName + ')' + ' Status Changed To ' + dec.PatientScriptStatus.get(MyRec.Status).key + ' | Line: ' + MyRec.ProcessLine);
					}
				});
			}

			if(!Param.Fields.ScriptNo){
				Param.Fields.ScriptNo = Rec.ScriptNo;
				Param.Fields.PatientId = Rec.PatientID;

				log.WriteToFile(ProcName, 'Script ' + Rec.ScriptNo + ' (' + Rec.PatientName + ')' + ' Status Changed To ' + dec.PatientScriptStatus.get(Rec.Status).key + ' | Line: ' + Line);
				PublishBottleNotification(ProcName, Line, false, ScannedItem);
				param.Update(Param, function(Resp){});
				return callback({Reject: false});
			}

			if(Param.Fields.PatientId != Rec.PatientID){
				log.WriteToFile(ProcName, 'Bottle Script No Barcode Scan Failed: Reason - PatientID [' + Param.Fields.PatientId + '] doesn�t match the held bottle patientID [' + Rec.PatientID + '] | Line: ' + Line);
				PublishBottleNotification(ProcName, Line, true, ScannedItem);

				WriteBottleReject(Param.Fields.ScriptNo,
				                  'Barcode doesn�t match the held bottle | Line: ' + Line,
				                  function(){});

				Param.Fields.ScriptNo = Rec.ScriptNo;
				Param.Fields.PatientId = Rec.PatientID;

				param.Update(Param, function(Resp){});

				return callback({Reject: true});
			}

			if(Param.Fields.ScriptNo == Rec.ScriptNo){
				log.WriteToFile(ProcName, 'Bottle Script No Barcode Scan Failed: Reason - Duplicate ScriptNo [' + Rec.ScriptNo + '] to the bottle scriptNo [' + Param.Fields.ScriptNo + '] in the held position | Line: ' + Line);
				PublishBottleNotification(ProcName, Line, true, ScannedItem);

				WriteBottleReject(ScannedItem,
				                  'Duplicate ScriptNo to the bottle in the held position | Line: ' + Line,
				                  function(){});

				Param.Fields.ScriptNo = Rec.ScriptNo;
				Param.Fields.PatientId = Rec.PatientID;

				param.Update(Param, function(Resp){});

				return callback({Reject: true});
			}

			let BotPairArr = [];
			BotPairArr.push(Param.Fields.ScriptNo);
			BotPairArr.push(Rec.ScriptNo);

			let body = {
				BatchID: Rec.BatchID,
				Bottle1: Param.Fields.ScriptNo,
				Bottle2: Rec.ScriptNo,
				Line: Line,
				Action: 'BOTTLE'
			}

			rest.postJson('http://localhost:3000/API/qUpdateCartonBottlePair', body).on('complete', function(result){
				if(result instanceof Error){
					log.WriteToFile(ProcName, 'Bottle Script No Barcode Scan Failed: Reason - ' + result + ' | Line: ' + Line);
					PublishBottleNotification(ProcName, Line, true, ScannedItem);

					WriteBottleReject(ScannedItem,
									  'Failed to commit bottle pair data',
									  function(){});

					Param.Fields.ScriptNo = Rec.ScriptNo;
					Param.Fields.PatientId = Rec.PatientID;

					param.Update(Param, function(Resp){});

					return callback({Reject: true});
				}

				Param.Fields.ScriptNo = '';
				Param.Fields.PatientId = '';
				param.Update(Param, function(Resp){
					log.WriteToFile(ProcName, 'Bottle Script No Barcode Scan Success: ScriptNo [' + BotPairArr[0] + '] paired with ScriptNo [' + BotPairArr[1] + ']' + ' | Line: ' + Line);
					PublishBottleNotification(ProcName, Line, false, ScannedItem);
					return callback({Reject: false});
				});
			});
		});
	} /* VerifyPLCBottleScan */

	BottleRejectStnScan(ScannedItem, callback){
		bottleReject.Find({'ScriptNo': ScannedItem}, function(Resp){
			if(!Resp.Arr){
				return callback({ErrMsg: 'Scanned item not found in reject list'});
			}

			let Arr = Resp.Arr;
			let Rec = Arr[Arr.length -1];
			return callback({Rec: Rec});
		});
	} /* BottleRejectStnScan */

	/* ==== Empty Carton ==== */

	VerifyPLCEmptyCartonScan(ScannedItem, Line, ProcName, callback){
		let Stack = {};
		let Statuses = [dec.BatchStatus.Assigned.value, dec.BatchStatus.Started.value];

		Stack.HeaderRec = function(callback){
			header.FindOne({'Status': {$in: Statuses}}, function(Resp){
				return callback(Resp.Err, Resp.Rec);
			});
		}

		Stack.ScriptArr = function(callback){
			detail.Find({'CartonID': ScannedItem}, function(Resp){
				return callback(Resp.Err, Resp.Arr);
			});
		}

		Stack.BottleCartonRec = function(callback){
			bottlecarton.FindOne({'CartonID': ScannedItem}, function(Resp){
				return callback(Resp.Err, Resp.Rec);
			});
		}

		async.parallel(Stack, function(err, Result){
			if(err){
				log.WriteToFile(ProcName, 'Empty Carton Barcode Scan Failed: Reason - ' + err + ' | Line: ' + Line);
				PublishEmptyCartonNotification(ProcName, Line, true, ScannedItem);
				return callback({Reject: true});
			}

			let BottleCartonRec = Result.BottleCartonRec;
                        let CartonUsed = false;
                        let CartonExist = false;
			let CartonReprint = false;
                        if(BottleCartonRec){
                                CartonExist = true;
				CartonReprint = BottleCartonRec.Reprint;
                                if(BottleCartonRec.Bottle1){
                                        CartonUsed = true;
                                }
                        }

			if(!Result.HeaderRec && !CartonReprint){
				log.WriteToFile(ProcName, 'Empty Carton Barcode Scan Failed: Reason - No active batch on the line | Line: ' + Line);
				PublishEmptyCartonNotification(ProcName, Line, true, ScannedItem);

				WriteEmptyCartonReject(ScannedItem,
				                   	   'Unknown',
				                       'No active batch on the line',
				                       function(){});

				return callback({Reject: true, RejectValue: 3});
			}

			let BatchRec = Result.HeaderRec;
			if(Result.ScriptArr && !CartonReprint){
				log.WriteToFile(ProcName, 'Empty Carton Barcode Scan Failed: Reason - Carton has already been used | Line: ' + Line);
				PublishEmptyCartonNotification(ProcName, Line, true, ScannedItem);

				WriteEmptyCartonReject(ScannedItem,
									   BatchRec.BatchID,
									   'Carton has already been used',
									   function(){});

				return callback({Reject: true});
			}

			if(ScannedItem.trim().toUpperCase().indexOf('NoRead'.toUpperCase()) >= 0){
				log.WriteToFile(ProcName, 'Empty Carton Barcode Scan Failed: Reason - [NoRead] Not a valid carton | Line: ' + Line);
				PublishEmptyCartonNotification(ProcName, Line, true, ScannedItem);

				WriteEmptyCartonReject(ScannedItem,
				                   	   BatchRec.BatchID,
				                       'Not a valid carton',
				                       function(){});

				return callback({Reject: true});
			}

			//let BottleCartonRec = Result.BottleCartonRec;
			//let CartonUsed = false;
			//let CartonExist = false;
			//if(BottleCartonRec){
			//	CartonExist = true;
			//	if(BottleCartonRec.Bottle1){
			//		CartonUsed = true;
			//	}
			//}
			if(CartonReprint){
				log.WriteToFile(ProcName, 'Empty Carton Barcode Scan Reprint Succes: Reason - Carton ' + ScannedItem + ' set for reprint | Line: ' + Line);
				PublishEmptyCartonNotification(ProcName, Line, true, ScannedItem);
				return callback({Reject: true, RejectValue: 4});
			}

			if(CartonExist && CartonUsed){
				log.WriteToFile(ProcName, 'Empty Carton Barcode Scan Failed: Reason - Carton has already been used | Line: ' + Line);
				PublishEmptyCartonNotification(ProcName, Line, true, ScannedItem);

				WriteEmptyCartonReject(ScannedItem,
									   BatchRec.BatchID,
									   'Carton has already been used',
									   function(){});

				return callback({Reject: true});
			}

			if(CartonExist && !CartonUsed){
				log.WriteToFile(ProcName, 'Empty Carton Barcode Scan Success: Carton ' + ScannedItem + ' ( Batch: ' + BatchRec.BatchID + ' )' + ' Is unique and ready to be used | Line: ' + Line);
				PublishEmptyCartonNotification(ProcName, Line, false, ScannedItem);

				return callback({Reject: false});
			}

			log.WriteToFile(ProcName, 'Empty Carton Barcode Scan Success: Carton ' + ScannedItem + ' ( Batch: ' + BatchRec.BatchID + ' )' + ' Is unique and ready to be used | Line: ' + Line);
			PublishEmptyCartonNotification(ProcName, Line, false, ScannedItem);

			return callback({Reject: false});

			/*let body = {
				BatchID: BatchRec.BatchID,
				CartonID: ScannedItem,
				Line: Line,
				Action: 'CARTON'
			}

			rest.postJson('http://localhost:3000/API/qUpdateCartonBottlePair', body).on('complete', function(result){
				if(result instanceof Error){
					log.WriteToFile(ProcName, 'Empty Carton Barcode Scan Failed: Reason - ' + result + ' | Line: ' + Line);
					PublishEmptyCartonNotification(ProcName, Line, true, ScannedItem);

					WriteEmptyCartonReject(ScannedItem,
										   BatchRec.BatchID,
										   'Failed to commit Carton Data',
										   function(){});

					return callback({Reject: true});
				}

				log.WriteToFile(ProcName, 'Empty Carton Barcode Scan Success: Carton ' + ScannedItem + ' ( Batch: ' + BatchRec.BatchID + ' )' + ' Is unique and ready to be used | Line: ' + Line);
				PublishEmptyCartonNotification(ProcName, Line, false, ScannedItem);

				return callback({Reject: false});
			});*/
		});
	} /* VerifyPLCEmptyCartonScan */

	DequeueUnusedCarton(ScannedItem, Line, ProcName, callback){

                if(ScannedItem.trim().toUpperCase().indexOf('NoRead'.toUpperCase()) >= 0){
                        log.WriteToFile(ProcName, 'Dequeue Unused Carton Failed: Reason - [NoRead] Not a valid carton | Line: ' + Line);
                	return callback({Reject: true});
        	}

		bottlecarton.FindOne({'CartonID': ScannedItem}, function(Resp){
			if(!Resp.Rec){
				log.WriteToFile(ProcName, 'Dequeue Unused Carton Failed: Reason - Carton not found | Line: ' + Line);
				return callback({Reject: true});
			}

 			let Rec = Resp.Rec;
			if(!Rec.Bottle1){
				bottlecarton.DeleteRecord({'Line': Line, 'CartonID': ScannedItem}, function(Resp){
					log.WriteToFile(ProcName, 'Dequeue Unused Carton Success: Reason - Carton ' + ScannedItem + ' no longer queued | Line: ' + Line);
					return callback({Reject: false});
				});
				return;

			}

			Rec.CartonID = null;
			Rec.LastUpdate= moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

			bottlecarton.Update(Rec, function(Resp){
				log.WriteToFile(ProcName, 'Dequeue Unused Carton Success: Reason - Carton ' + ScannedItem + ' no longer queued to be paired with Bottle1: ' + Rec.Bottle1 + ' | Bottle2: ' + Rec.Bottle2 + ' | Line: ' + Line);
				return callback({Reject: false});
			});
                });
	} /* DequeueUnusedCarton */

	EmptyCartonRejectStnScan(ScannedItem, callback){
		emptyCartonReject.Find({'CartonID': ScannedItem}, function(Resp){
			if(!Resp.Arr){
				return callback({ErrMsg: 'Scanned item not found in reject list'});
			}

			let Arr = Resp.Arr;
			let Rec = Arr[Arr.length -1];
			return callback({Rec: Rec});
		});
	} /* EmptyCartonRejectStnScan */

	/* ==== Bottle Insertion ==== */

	VerifyPLCBottleInsertion(ScannedItem, Line, ProcName, callback){
		//let Statuses = [dec.BatchStatus.Assigned.value, dec.BatchStatus.Started.value];
		//header.FindOne({'Status': {$in: Statuses}}, function(Resp){
		//	if(!Resp.Rec){
		//		log.WriteToFile(ProcName, 'Bottle Insertion Failed: Reason - No active batch on the line | Line: ' + Line);

		//		WriteEmptyCartonReject(ScannedItem,
		//		                   	   'Unknown',
		//		                       'No active batch on the line', function(){
		//			return callback({Reject: true});
		//		});

		//		return;
		//	}

		//	let BatchRec = Resp.Rec;
			if(ScannedItem.trim().toUpperCase().indexOf('NoRead'.toUpperCase()) >= 0){
				log.WriteToFile(ProcName, 'Bottle Insertion Failed: Reason - [NoRead] Not a valid carton | Line: ' + Line);
				PublishEmptyCartonNotification(ProcName, Line, true, ScannedItem);

				WriteEmptyCartonReject(ScannedItem,
				                   	   'Unknown',
				                       'Not a valid carton',
				                       function(){});

				return callback({Reject: true});
			}

			bottlecarton.FindOne({'Line': Line, 'Bottle1': {$ne: null}, 'Processed': false}, function(Resp){
				if(Resp.Err || !Resp.Rec){
					log.WriteToFile(ProcName, 'Bottle Insertion Failed: Reason - No bottle carton pair waiting to be processed | Line: ' + Line);
					return callback({Reject: true});
				}

				let Rec = Resp.Rec;
				let ScriptArr = [];
				ScriptArr.push(Rec.Bottle1);
				if(Rec.Bottle2){
					ScriptArr.push(Rec.Bottle2);
				}

				let CartonID = ScannedItem;

				UpdateCartonToScripts(ScriptArr, 0, CartonID, Line, ProcName, function(){
					Rec.Processed = true;
					Rec.CartonID = CartonID;
					Rec.LastUpdate= moment(new Date()).format('YYYY-MM-DD HH:mm:ss');


					bottlecarton.Update(Rec, function(Resp){
						//SendScriptLabelJob(ScriptArr, Line, function(Resp){
							//if(Resp.Err){
							//	log.WriteToFile(ProcName, 'Bottle Insertion Failed: Reason - ' + Resp.Err + ' | Line: ' + Line);
							//	return callback({Reject: true});
							//}

							log.WriteToFile(ProcName, 'Bottle Insertion Success: Carton: ' + CartonID + ' Paired | Line: ' + Line);
							return callback({Reject: false});
						//});
					});
				});
			});
		//});
	} /* VerifyPLCBottleInsertion */

	/* ==== Script Labelling ==== */

	PrintCartonScript(ScannedItem, Line, ProcName, callback){
		if(ScannedItem.trim().toUpperCase().indexOf('NoRead'.toUpperCase()) >= 0){
			log.WriteToFile(ProcName, 'Script Label Print Failed: Reason - [NoRead] Not a valid carton | Line: ' + Line);
			PublishEmptyCartonNotification(ProcName, Line, true, ScannedItem);

			WriteEmptyCartonReject(ScannedItem,
								   'Unknown',
								   'Not a valid carton',
								   function(){});

			return callback({Reject: true});
		}

		bottlecarton.FindOne({'Line': Line, 'CartonID': ScannedItem}, function(Resp){
			if(Resp.Err || !Resp.Rec){
				log.WriteToFile(ProcName, 'Script Label Print Failed: Reason - Invalid carton scanned | Line: ' + Line);
				return callback({Reject: true});
			}

			let Rec = Resp.Rec;
			let ScriptArr = [];
			ScriptArr.push(Rec.Bottle1);
			if(Rec.Bottle2){
				ScriptArr.push(Rec.Bottle2);
			}

			let CartonID = ScannedItem;

			SendScriptLabelJob(ScriptArr, Line, function(Resp){
				if(Resp.Err){
					log.WriteToFile(ProcName, 'Script Label Print Failed: Reason - ' + Resp.Err + ' | Line: ' + Line);
					return callback({Reject: true});
				}

				log.WriteToFile(ProcName, 'Script Label Print Success: Domino Print Script Label created for carton: ' + CartonID + ' | Line: ' + Line);
				return callback({Reject: false});
			});
		});
	} /* PrintCartonScript */

	VerifyPLCScriptLabel(ScannedItem, ValuesArr, Line, ProcName, callback){
		let Statuses = [dec.BatchStatus.Assigned.value, dec.BatchStatus.Started.value];
		header.FindOne({'Status': {$in: Statuses}}, function(Resp){
			if(!Resp.Rec){
				log.WriteToFile(ProcName, 'Script Label Failed: Reason - No active batch on the line | Line: ' + Line);
				PublishScriptLabelNotification(ProcName, Line, true, ScannedItem);

				WritePatientScriptReject(ValuesArr[0],
				                         '',
				                   	     'Unknown',
				                         'No active batch on the line', function(){
					return callback({Reject: true});
				});

				return;
			}

			let BatchRec = Resp.Rec;

			let ScannedCartonID = null;
			let ScannedPatientScript = null;
			let ScriptArr = [];
			let x = 0;
			while(x < ValuesArr.length){
				if(ValuesArr[x].length != 11 && ValuesArr[x].indexOf("PDC") != 0){
					ScannedCartonID = ValuesArr[x];
				} else {
					ScannedPatientScript = ValuesArr[x];
					ScriptArr.push(ValuesArr[x]);
				}
				x++;
			}

			//console.log('ScannedCartonID: ' + ScannedCartonID);
			//console.log('ScriptArr: ');
			//console.log(ScriptArr);

			detail.Find({'CartonID': ScannedCartonID}, function(Resp){
				if(!Resp.Arr){
					log.WriteToFile(ProcName, 'Script Label Failed: Reason - Failed to find scanned carton [' + ScannedCartonID + '] | Line: ' + Line);
					PublishScriptLabelNotification(ProcName, Line, true, ScannedItem);

					WritePatientScriptReject(ScannedCartonID,
											 ScannedPatientScript,
									         BatchRec.BatchID,
									         'Carton Does Not Exist', function(){
						return callback({Reject: true});
					});

					return;
				}

				let BatchDetArr = Resp.Arr;
				x = 0;
				let ExistArr = [];
				while(x < BatchDetArr.length){
					let y = 0;
					let Match = false;
					while(y < ScriptArr.length){
						if(BatchDetArr[x].ScriptNo == ScriptArr[y]){
							ExistArr.push({ScriptNo: BatchDetArr[x].ScriptNo, CartonMatch: true});
							Match = true;
							break;
						}
						y++;
					}

					/*if(!Match){
						ExistArr.push({ScriptNo: BatchDetArr[x].ScriptNo, CartonMatch: false});
					}*/
					x++;
				}

				x = 0;
				while(x < ScriptArr.length){
					let y = 0;
					let Found = false;
					while(y < ExistArr.length){
						if(ScriptArr[x] == ExistArr[y].ScriptNo){
							Found = true;
							break;
						}
						y++;
					}

					if(!Found){
						ExistArr.push({ScriptNo: ScriptArr[x], CartonMatch: false});
					}
					x++;
				}

				LogPatientScriptRejects(ExistArr, 0, ScannedCartonID, false, BatchRec.BatchID, Line, ProcName, function(Resp){
					if(Resp.Reject){
						PublishScriptLabelNotification(ProcName, Line, true, ScannedItem);
					} else {
						PublishScriptLabelNotification(ProcName, Line, false, ScannedItem);
					}

					return callback(Resp);
				});
			});
		});
	} /* VerifyPLCScriptLabel */

	ScriptLabelRejectStnScan(ScannedItem, callback){
		patientScriptReject.Find({'CartonID': ScannedItem}, function(Resp){
			if(!Resp.Arr){
				return callback({ErrMsg: 'Scanned item not found in reject list'});
			}

			let Arr = Resp.Arr;
			let Rec = Arr[Arr.length -1];
			return callback({Rec: Rec});
		});
	} /* ScriptLabelRejectStnScan */

	/* ==== Carton Shipment Labelling ==== */

	VerifyPLCCartonShipment(ScannedCartonID, ProcName, callback){
		detail.Find({'CartonID': ScannedCartonID}, function(Resp){
			if(!Resp.Arr){
				log.WriteToFile(ProcName, 'Shipment Carton Failed: Reason - Failed to find scanned carton [' + ScannedCartonID + ']');
				PublishDespatchLabelNotification(ProcName, true, ScannedCartonID, '-');
				return callback({Reject: true});
			}

			let Arr = Resp.Arr;
			let x = 0;
			let IncorrectStatus = false;
			while(x < Arr.length){
				if(Arr[x].Status != dec.PatientScriptStatus.Labelled.value &&
				   Arr[x].Status != dec.PatientScriptStatus.Packed.value){
					IncorrectStatus = true;
					break;
				}
				x++;
			}

			if(IncorrectStatus){
				log.WriteToFile(ProcName, 'Shipment Carton Failed: Reason - Scanned carton not in a correct state. Required Statuses [Labelled; Packed]');
				PublishDespatchLabelNotification(ProcName, true, ScannedCartonID, '-');
				return callback({Reject: true});
			}

			if(Arr[0].ParcelReferenceNo){
				//return callback({Reject: false});
				SendShipmentLabelPrintJob(Arr, function(Resp){
					if(Resp.Err){
						log.WriteToFile(ProcName, 'Shipment Carton Failed: Reason - ' + Resp.Err);
						PublishDespatchLabelNotification(ProcName, true, ScannedCartonID, Arr[0].ParcelReferenceNo);
						return callback({Reject: true});
					}

					log.WriteToFile(ProcName, 'Shipment Carton Success: Domino Print Shipment Label created for carton [' + ScannedCartonID + '] | ParcelReferenceNo [' + Arr[0].ParcelReferenceNo + ']');
					PublishDespatchLabelNotification(ProcName, false, ScannedCartonID, Arr[0].ParcelReferenceNo);
					return callback({Reject: false});
				});

				return;
			}

			let Prefix = 'NHA';
			let FileNumber = Arr[0].FileNumber;

			GetPatientFileNextSequenceNum(FileNumber, function(Resp){
				let SeqNum = Resp.SeqNo;

				let ParcelReferenceNo = Prefix + FileNumber + formatted_string('000', SeqNum, 'l');

				UpdateEachRecStatus(Arr, 0, dec.PatientScriptStatus.Packed.value, ParcelReferenceNo, function(){
					SendShipmentLabelPrintJob(Arr, function(Resp){
						if(Resp.Err){
							log.WriteToFile(ProcName, 'Shipment Carton Failed: Reason - ' + Resp.Err);
							PublishDespatchLabelNotification(ProcName, true, ScannedCartonID, ParcelReferenceNo);
							return callback({Reject: true});
						}

						log.WriteToFile(ProcName, 'Shipment Carton Success: Domino Print Shipment Label created for carton [' + ScannedCartonID + '] | ParcelReferenceNo [' + ParcelReferenceNo + ']');
						PublishDespatchLabelNotification(ProcName, false, ScannedCartonID, ParcelReferenceNo);
						return callback({Reject: false});
					});
				});
			});
		});
	} /* VerifyPLCCartonShipment */

	/* ==== Shipment Label Verification ==== */

	VerifyPLCShipmentLabel(ScannedItems, ScannedCartonID, ScannedShipmentID, ProcName, callback){
		if(!ScannedCartonID){
			log.WriteToFile(ProcName, 'Shipment Label Failed: Reason - No Carton ID Received');
			PublishShipmentLabelNotification(ProcName, true, ScannedItems);

			WriteShipmentReject('Unknown',
								ScannedShipmentID,
								'No CartonID Scanned', function(){
				return callback({Reject: true});
			});
			return;
		}

		if(!ScannedShipmentID){
			log.WriteToFile(ProcName, 'Shipment Label Failed: Reason - No Shipment ID Received');
			PublishShipmentLabelNotification(ProcName, true, ScannedItems);

			WriteShipmentReject(ScannedCartonID,
								'Unknown',
								'No ShipmentID Scanned', function(){
				return callback({Reject: true});
			});
			return;
		}

		detail.Find({'CartonID': ScannedCartonID}, function(Resp){
			if(!Resp.Arr){
				log.WriteToFile(ProcName, 'Shipment Label Failed: Reason - Scanned carton [' + ScannedCartonID + '] does not exist');
				PublishShipmentLabelNotification(ProcName, true, ScannedItems);
				return callback({Reject: true});
			}

			let Arr = Resp.Arr;
			let x = 0;
			let IncorrectStatus = false;
			while(x < Arr.length){
				if(Arr[x].ParcelReferenceNo != ScannedShipmentID){
					IncorrectStatus = true;
					break;
				}
				x++;
			}

			if(IncorrectStatus){
				log.WriteToFile(ProcName, 'Shipment Label Failed: Reason - Scanned ShipmentID [' + ScannedShipmentID + '] is not linked to CartonID [' + ScannedCartonID + ']');
				PublishShipmentLabelNotification(ProcName, true, ScannedItems);
				WriteShipmentReject(ScannedCartonID,
				                    ScannedShipmentID,
				                    'ShipmentID not linked to CartonID', function(){
					return callback({Reject: true});
				});
				return;
			}

			PublishShipmentLabelNotification(ProcName, false, ScannedItems);
			return callback({Reject: false});
		});
	} /* VerifyPLCShipmentLabel */

	ShipmentLabelRejectStnScan(ScannedItem, callback){
		shipmentReject.Find({'CartonID': ScannedItem}, function(Resp){
			if(!Resp.Arr){
				return callback({ErrMsg: 'Scanned item not found in reject list'});
			}

			let Arr = Resp.Arr;
			let Rec = Arr[Arr.length -1];
			return callback({Rec: Rec});
		});
	} /* ShipmentLabelRejectStnScan */

	/* ==== Tray Verification ==== */

	VerifyPLCTray(ScannedTrayID, ScannedManifestID, ProcName, callback){
		tray.FindOne({'TrayID': ScannedTrayID}, function(Resp){
			if(!Resp.Rec){
				WriteTrayReject(ScannedTrayID,
				                ScannedManifestID,
				                'Invalid Tray ID scanned', function(){
					return callback({Reject: true});
				});

				return;
			}

			let Rec = Resp.Rec;
			if(Rec.ManifestID != ScannedManifestID){
				WriteTrayReject(ScannedTrayID,
				                ScannedManifestID,
				                'Scanned Manifest ID is not linked to Tray', function(){
					return callback({Reject: true});
				});

				return;
			}

			return callback({Reject: false});
		});
	} /* VerifyPLCTray */

	TrayRejectStnScan(ScannedItem, callback){
		trayReject.Find({'Script_Number': ScannedItem}, function(Resp){
			if(!Resp.Arr){
				return callback({ErrMsg: 'Scanned item not found in reject list'});
			}

			let Arr = Resp.Arr;
			let Rec = Arr[Arr.length -1];
			return callback({Rec: Rec});
		});
	} /* TrayRejectStnScan */

} /* Verify */
