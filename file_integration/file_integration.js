var mongoose         	= require('mongoose');
var moment           	= require('moment');
var glob             	= require('glob');
var fs               	= require('fs');
var async            	= require('async');
var LineByLineReader 	= require('line-by-line');
var exec             	= require('child_process').spawn;

var config           	= require('../config/sysconfig');
var logging          	= require('../lib/classLogging');
var parameter        	= require('../lib/classParam');
var BatchHeaderLib      = require('../lib/classBatchSummary');
var BatchDetailLib      = require('../lib/classBatchFullDetails');
var dec                 = require('../lib/declaration');
var aeLib               = require('../lib/classAE');

var header	   	        = new BatchHeaderLib();
var detail	   	        = new BatchDetailLib();
var log            	    = new logging();
var param          	    = new parameter();
var ae                  = new aeLib();

let ProcName            = 'FILE_INT';
var DirectorySetting    = null;

/* Mongo Connection */
mongoose.connect(config.mongoDB.url,{"useNewUrlParser" : true }, function (error, client) {
    if (error) {
        log.WriteToFile(ProcName, 'MongoDB: Connection Error: ' + error);
    } else {
        log.WriteToFile(ProcName, 'MongoDB: Connection Established.');
		WaitForTrigger();
    }
}); /* Mongo Connection */

function ValidateFile(task, callback){
	let FullFilePath = task.path + task.filename;
	let FileArr = FullFilePath.split('/');
	let FileName = FileArr[FileArr.length -1];
	let FirstLine = true;
	let LineError = false;
	let DataLineCount = 1;
	let ErrorMsg = null;
	let MyFile = task.filename;
	let MyFileArr = MyFile.split('.');

	if(MyFileArr.length < 2){
		ErrorMsg = 'Failed to read file | Incorrect file type.';
		
		MoveFileAccordingly(FullFilePath, false, ErrorMsg, function(){
			return callback();
		});

		return;
	}

	if(MyFileArr[MyFileArr.length -1] != DirectorySetting.FileExtension){
		ErrorMsg = 'Failed to read file | Incorrect file extension.';
		MoveFileAccordingly(FullFilePath, false, ErrorMsg, function(){
			return callback();
		});

		return;
	}

	fs.appendFileSync(FullFilePath, '\n');

	let lrNew = new LineByLineReader(FullFilePath,{ skipEmptyLines: true });

	lrNew.on('error', function (err){
		ErrorMsg = 'Failed to read file | Err: ' + err;
		
		MoveFileAccordingly(FullFilePath, false, ErrorMsg, function(){
			return callback();
		});

		return;
	});

	lrNew.on('line', function (line){
		if(!LineError){
			let LineDataArr = line.split(DirectorySetting.Delimeter);
			if(FirstLine == true && DirectorySetting.FileIncludesHeader == true){
				FirstLine = false;
			} else {
				if(LineDataArr.length != DirectorySetting.NoOfColumns){
					
					ErrorMsg = 'Line [' + (DataLineCount) + '] in file | Columns count mismatch [' + LineDataArr.length + '] | Expected [' + DirectorySetting.NoOfColumns + '] - [' + LineDataArr[37] + '] | [' + line + ']';
					LineError = true;
				}

				header.FindOne({'Production_Batch':LineDataArr[0]},function(Resp){
					if(Resp.Rec){
						ErrorMsg = "Production_Batch already exists";
						LineError  = true;
					}
				});

				DataLineCount++;
			}
		}
	});
	
	

///
lrNew.on('end', function (){
	if(LineError == false && DataLineCount > 0){
	
			ProcessFile(FullFilePath, function(Resp){
				let Success = true;
				if(Resp.Err){
					ErrorMsg = Resp.Err;
					Success = false;
				} else {
					ErrorMsg = 'File processed successfully';
					
				}

				MoveFileAccordingly(FullFilePath, Success, ErrorMsg, function(){
					
					return callback();
				});
			});
			
		
	} else {
		if(DataLineCount <= 0 && !LineError){
			ErrorMsg = 'File is empty';
		}

		MoveFileAccordingly(FullFilePath, false, ErrorMsg, function(){
			return callback();
		});
	}
});
} /* ValidateFile */

function MoveFileAccordingly(File, Success, Msg, callback){
	console.log('Original path: ' + File);
	let Dest = DirectorySetting.Processed;
	
	let FileArr = File.split('\\');

	if(FileArr.length <= 1){
		FileArr = File.split('/');
	}


	let FileName = FileArr[FileArr.length -1];
	
	log.WriteToFile(ProcName, 'filename without path: ' + FileName);

	if(Success === false){
		Dest = DirectorySetting.Failed;
	}

	log.WriteToFile(ProcName, 'Dest path: ' + Dest);
	log.WriteToFile(ProcName, 'Dest path with filename: ' + Dest + FileName);

	fs.readFile(File, function (err, data) {
		fs.writeFile(Dest + FileName, data, function(err) {
			fs.unlink(File, function (err) {
				if(err){
					log.WriteToFile(ProcName, 'Failed to rename file ' + err);
				}

				log.WriteToFile(ProcName, Msg);

				let TrStatus = 'FAILED';
				if(Success){
					TrStatus = 'SUCCESS';
				}

				log.WriteTransactionToDB(FileName, 'New Incoming File For Process', Msg, 'INCOMING', TrStatus, 'FILE INTEGRATION', function(err, saveDoc){
					let NewAE = {
						Type: 'FILE INTEGRATION',
						UsersViewed: [],
						Message: FileName + ' - ' + Msg,
						CreateDate: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
					}

					ae.New(NewAE, function(Resp){
						return callback();
					});
				});
			});
		});
	});
} /* MoveFileAccordingly */

function GetDetail(Obj, callback){
	detail.Find(Obj, function(Resp){
		return callback(Resp);
	});
} /* GetDetail */

function AddBatchHeader(HeaderRecord, callback){
	let NewHeader = {
		Production_Batch:HeaderRecord.Production_Batch,
		Patients:HeaderRecord.Patients,
		Processed: HeaderRecord.Processed,
		Date_Required: HeaderRecord.Date_Required,
		Status: dec.BatchStatus.New.value,
		created_at: HeaderRecord.created_at,
		updated_at: HeaderRecord.updated_at
	
	};

	header.New(NewHeader, function(Resp){
	});

	return callback;
} /* AddBatchHeader */


function ProcessFile(file,callback){
	let FirstLine = true;
	let LineError = false;
	let ErrorMsg = null;
	let HeaderRecord = null;
	let PatientCount = 0;

			console.log('Processing lines now...');
			
			let lrNew = new LineByLineReader(file,{ skipEmptyLines: true });

			lrNew.on('error', function (err){
				ErrorMsg = 'Failed to read file [' + file + ']. | Err: ' + err;
				return callback({Err: ErrorMsg});
			});

			lrNew.on('line', function (line){
				console.log(line);
				
				if(!LineError){
					lrNew.pause();
					let data = line.split(DirectorySetting.Delimeter);

					if(FirstLine == true && DirectorySetting.FileIncludesHeader == true){
						FirstLine = false;
						lrNew.resume();
					} else {

						let NewDetail = {
							
							Production_Batch: data[0],
							Print_Batch : data[1],
							Client_Name : data[2],
							Client_Address : data[3],
							Double_Dispensing_Indicator : data[4],
							Date_Dispensed : data[5],
							Script_Number : data[6],
							Item_Count : data[7],
							Drug_Description : data[8],
							Dosage_Line_1 : data[9],
							Dosage_Line_2 : data[10],
							Dosage_Line_3 : data[11],
							Dosage_Line_4 : data[12],
							Title : data[13],
							Initials : data[14],
							Surname : data[15],
							Repeat : data[16],
							Pharmacist : data[17],
							File_No : data[18],
							Batch : data[19],							
							Expiry : data[20],
							Lane : data[21],
							FCY : data[22],
							SQ : data[23],
							Order_No : data[24],
							Line_No : data[25],
							Hospital_Ref : data[26],
							Production_Batch_1 : data[27],
							Production_Batch_2 : data[28],
							Production_Expiry : data[29],
							Surname : data[30],
							Name : data[31],
							Fridge : data[32],
							SSEQ : data[33],
							Date_Of_Birth : data[34],
							Date_Dispensed : data[35],
							Cell_No : data[36],
							ID_Number : data[37],
							File_No : data[38],
							Collection_Date : data[39],
							Next_Collection_Date : data[40],
							Collection_Point : data[41],
							Profile_No : data[42],
							Script_Number : data[43],
							Repeat : data[44],
							Item_Count : data[45],
							Repeat_Notice : data[46],
							Following_Items_Not_Included : data[47],
							Line_1 : data[48],
							Line_2 : data[49],
							Line_3 : data[50],
							Line_4 : data[51],
							Facility_Review : data[52],
							Parcel_Ref : data[53],
							Collection_Point_Ref : data[54],
							Collection_Date : data[55],
							MpNo : data[56],
							Name : data[57],
							Surname : data[58],
							Hub : data[59],
							Zone : data[60],
							Second_Rx_Ref : data[61],
							Fridge : data[62],
							Parcel_Reference_Number : data[63],
							MAN_SEQ: data[64],
							SEQUENCE: data[65],
							Status: dec.PatientScriptStatus.New.value,
							CCMDD:null,
                            Proxy_Name_1:null,
                            Proxy_1_ID:null,
                            Proxy_Name_2:null,
                            Proxy_2_ID:null,
                            WCSStatus:null,
							created_at: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
							updated_at: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')
						}

				
						let Duplicate = false;
						GetDetail({'Script_Number': NewDetail.Script_Number}, function(Resp){
							let PatientRecList = Resp.Arr;
							if(!PatientRecList){
								IncrementPatientCount = true;
							} else {
							
								Duplicate = true;
							}

							if(Duplicate){
								ErrorMsg = 'Duplicate Record Found For Patient [' + NewDetail.Name + '] | Script_Number [' + NewDetail.Script_Number + ']';
								LineError = true;
								lrNew.resume();
							} else {
								detail.New(NewDetail, function(Resp){
									if(Resp.Err){
										ErrorMsg = 'Failed to create record for Script_Number ' + NewDetail.Script_Number + ' in file [' + file + ']. | Err: ' + Resp.Err;
										LineError = true;
										lrNew.resume();
									} else {
							
										
											PatientCount = PatientCount + 1;	
											let Processed = 0;

											HeaderRecord = {
												Production_Batch:NewDetail.Production_Batch,							
												Date_Required:NewDetail.Collection_Date,
												Patients:PatientCount,
												Processed:Processed,
												created_at: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
												updated_at:	moment(new Date()).format('YYYY-MM-DD HH:mm:ss')							
							                    
											}

										lrNew.resume();
									}
								
								});

							}
						});
					}
				}
			});

			lrNew.on('end', function(){
				CompleteFileReceive(HeaderRecord, LineError, ErrorMsg, file, function(Resp){
					AddBatchHeader(HeaderRecord, function(){
			
					});
					return callback(Resp);
				});

});
} /* ProcessFile */

function CompleteFileReceive(HeaderRecord, LineError, ErrorMsg, file, callback){
	let Err = null;
	if(LineError){
		Err = ErrorMsg;
	}

	if(LineError){
		detail.Delete({'Production_Batch': HeaderRecord.Production_Batch}, function(Resp){
			header.Delete({'Production_Batch': HeaderRecord.Production_Batch}, function(Resp){
				return callback({Err: Err});
			});
		});
	} else {
		HeaderRecord.Status = dec.BatchStatus.New.value;
		HeaderRecord.updated_at = moment(new Date()).format('YYYY-MM-DD HH:mm:ss');

		header.Update(HeaderRecord, function(Resp){
			let Msg = 'Successfully created Batch ' + HeaderRecord.Production_Batch + ' in from File ' + file;
			log.WriteToFile(ProcName, Msg);
            
			return callback({Err: Err});
		});
	}
} /* CompleteFileReceive */

function ProcessEachFile(files, index, path, callback){
	if(index >= files.length){
		return callback();
	}

	let FileName = files[index];
	ValidateFile({path: path, filename: FileName}, function(){
		index++;
		return ProcessEachFile(files, index, path, callback);
	});
} /* ProcessEachFile */

function loadFile(callback){
	
}

function FindNewFiles(callback){
	let path = DirectorySetting.New;

	fs.readdir(path, function(err, files){
		if(err){
			log.WriteToFile(ProcName, 'Failed to find new  files in [' + DirectorySetting.New + ']. | Err: ' + err );
			return callback();
		}

		if(!files || files.length <= 0){
			return callback();
		}

		let x = 0;
		log.WriteToFile(ProcName, files.length + ' File(s) available to pickup');
		
		console.log(files);

		ProcessEachFile(files, 0, path, function(){
			console.log('The queue has finished processing!');
			
			return callback();
		});
	});
} /* FindNewFiles */


function CheckFilesInDir(callback){
	
	param.FindOne({'ParameterName': 'FileIntegration'}, function(Resp){
		if(Resp.Err){
			log.WriteToFile(ProcName, 'Failed to find [File Integration] parameters. | Err: ' + Resp.Err);
			return callback();
		}

		if(!Resp.Param){
			log.WriteToFile(ProcName, 'File Integration parameters are not setup on the system');
			return callback();
		}

		DirectorySetting = Resp.Param.Fields;
		FindNewFiles(function(){
			return callback();
		});
	});
}; /* CheckFilesInDir */

function WaitForTrigger(){
	setTimeout(function(){
	  	CheckFilesInDir(function(){
			WaitForTrigger();
		});
	}, 10000);
} /* WaitForTrigger */