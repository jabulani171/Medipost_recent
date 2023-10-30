var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var async          = require('async');
var moment 		   = require('moment');
var rest           = require('restler');
var redis          = require('redis');
var exec           = require('child_process').spawn;

var port           = require('../../../config/sysconfig').port;
var HtmlLib	       = require('../../../lib/classHtml');
var dec            = require('../../../lib/declaration');
var paramLib	   = require("../../../lib/classParam");
var LogLib	       = require('../../../lib/classLogging');
var StnLib         = require('../../../lib/classPackingStation');
var BatchHeaderLib = require('../../../lib/classBatchSummary');
var BatchDetailLib = require('../../../lib/classBatchFullDetails');
var TrayLib        = require('../../../lib/classTray');
var classTrayRejectLib        = require('../../../lib/classTrayReject');
var PrinterLib     = require('../../../lib/classPrinter');
const { Console } = require('console');

var router         = express.Router();
var html           = new HtmlLib();
var param 		   = new paramLib();
var log 		   = new LogLib();
var stn            = new StnLib();
var header         = new BatchHeaderLib();
var detail         = new BatchDetailLib();
var tray           = new TrayLib();
var trayReject     = new classTrayRejectLib();
var prn            = new PrinterLib();

PublishClient      = redis.createClient();

function ShowPackingStationScreen(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	let StnIP = null;
	frame.ext = html.GetPage('packing');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('OperatePackingStation') >= 0){
		Data.Granted = true;
	}

    if(Data.Granted){
        StnIP = html.GetIpAddress(req);

        stn.FindOne({'Packing_Station_IP':StnIP},function(Resp){
            if(!Resp.Rec){
				Data.StnIP = StnIP;

				let htmlpage = mustache.render(page, Data, frame);
				return res.send(htmlpage);
			}
            else{

            StnRec = Resp.Rec;

            Data.Station = StnRec.Packing_Station_ID;
            header.FindOne({'Status':dec.BatchStatus.Started.value},function(Resp){
                if(!Resp.Rec){
                    Data.ProductionData = false;
                    Data.PatientData = false;
                    Data.STN_MSG = 'No Batch Started';
                    Data.Configured = true;
                 
                    let htmlpage = mustache.render(page, Data, frame);
                    res.send(htmlpage);
                }
                else{

                Rec = Resp.Rec;
                Data.Configured = true;

                if(req.session.scannedfirstbottle){
                    let ScannedFirstBottle = req.session.scannedfirstbottle;
                    delete req.session.scannedfirstbottle;
                 
                    return ProcessFirstPatientBottleScanned(ScannedFirstBottle,Rec, StnRec, loggedInUser, frame, page, Data, req, res);
                }

                if(req.session.scannedsecondbottle){
                    let ScannedSecondBottle = req.session.scannedsecondbottle;
                    delete req.session.scannedsecondbottle;
                 
                    return ProcessSecondPatientBottleScanned(ScannedSecondBottle,Rec, StnRec, loggedInUser, frame, page, Data, req, res);
                }

                if(req.session.scannedcarton){
                    let ScannedCarton = req.session.scannedcarton;
                    delete req.session.scannedcarton;
                 
                    return ProcessCartonScanned(ScannedCarton,Rec, StnRec, loggedInUser, frame, page, Data, req, res);
                }

                if(req.session.stationreset){
					delete req.session.stationreset;

					return ProcessStationReset(StnRec, loggedInUser, frame, page, Data, req, res);
				}

                return WhereToNext(StnRec,Rec, loggedInUser, frame, page, Data, req, res);
            }
            });
        }
        });
    }
} 

router.get('/API/packingstation', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowPackingStationScreen(null, loggedInUser, req, res);
});

function WhereToNext(StnRec,Rec, loggedInUser, frame, page, Data, req, res){
let ActivePatient=StnRec.ActivePatient;

if(ActivePatient)
{
    detail.FindOne({'Script_Number':ActivePatient,'Production_Batch':Rec.Production_Batch},function(Resp){
        let PatientRec = Resp.Rec;
        
        detail.Find({'File_No':PatientRec.File_No,'Production_Batch':PatientRec.Production_Batch},function(Resp){
            let Arr = Resp.Arr;

            if(Arr.length == 1){

                Data.PatientData = true;
                Data.ProductionData = true;
                Data.InputData = true;
                Data.Reset = true;
                Data.Reprint = true;
                Data.StnActionData = true;
                Data.Production_Batch = Rec.Production_Batch;
                Data.Patient = PatientRec.Name+" "+PatientRec.Surname;
                Data.StnAction = 'CartonScan';
                Data.STN_ACTION = 'Scan Label Barcode';
        
                let htmlpage = mustache.render(page, Data, frame);
                return res.send(htmlpage);
            }
            else
            
            {

                if(Arr[1].Status == dec.PatientScriptStatus.Packed.value){

                    Data.PatientData = true;
                    Data.ProductionData = true;
                    Data.InputData = true;
                    Data.Reset = true;
                    Data.Reprint = true;
                    Data.StnActionData = true;
                    Data.Production_Batch = Rec.Production_Batch;
                    Data.Patient = PatientRec.Name+" "+PatientRec.Surname;
                    Data.StnAction = 'CartonScan';
                    Data.STN_ACTION = 'Scan Label Barcode';
            
                    let htmlpage = mustache.render(page, Data, frame);
                    return res.send(htmlpage);
                }
                else{
                    Data.PatientData = true;
                    Data.ProductionData = true;
                    Data.InputData = true;
                    Data.Reset = true;
                    Data.StnActionData = true;
                    Data.Production_Batch = Rec.Production_Batch;
                    Data.Patient = PatientRec.Name+" "+PatientRec.Surname;
                    Data.StnAction = 'SecondPatientBottleScan';
                    Data.STN_ACTION = 'Scan 2nd Patient Bottle';
            
                    let htmlpage = mustache.render(page, Data, frame);
                    res.send(htmlpage);
                }
              
            }
        });
    });
}
else
{

detail.Find({'Status':dec.PatientScriptStatus.Printed.value},function(Resp){
 if(!Resp.Arr){
        Data.STN_MSG = 'No Packed Patients';
       
        let htmlpage = mustache.render(page, Data, frame);
        return res.send(htmlpage);
    }

   if(!Rec){
    return;
   }
   
        Data.ProductionData = true;
        Data.InputData = true;
        Data.StnActionData = true;
        Data.Production_Batch = Rec.Production_Batch;
        Data.STN_ACTION = 'Scan 1st Patient Bottle';
        Data.StnAction = 'FirstPatientBottleScan';

        let htmlpage = mustache.render(page, Data, frame);
        return res.send(htmlpage);
});
}
}

//FIRST PATIENT BOTTLE
function ProcessFirstPatientBottleScanned(ScannedFirstBottle,Rec, StnRec, loggedInUser, frame, page, Data, req, res){
    Data.STN_ACTION = 'Scan 1st Patient Bottle';
	Data.StnAction = 'FirstPatientBottleScan';
    
    StnRec.ActivePatient = ScannedFirstBottle;

    if(!Rec){
        return;
    }

    detail.FindOne({'Script_Number':ScannedFirstBottle,'Production_Batch':Rec.Production_Batch},function(Resp){
        if(!Resp.Rec){
            Data.STN_MSG = 'Scanned First Bottle ' + ScannedFirstBottle + ' Not Found On The System';


            let htmlpage = mustache.render(page, Data, frame);
			return res.send(htmlpage);
        }

        let PatientRec = Resp.Rec;

        if(PatientRec.Status == dec.PatientScriptStatus.Packed.value){
            Data.STN_MSG = 'Scanned First Bottle ' + ScannedFirstBottle + ' Already Packed';
            Data.StnActionData = false;
            let htmlpage = mustache.render(page, Data, frame);
            return res.send(htmlpage);
        }

detail.Find({'File_No':PatientRec.File_No,'Production_Batch':Rec.Production_Batch},function(Resp){
if(!Resp.Arr){
    Data.STN_MSG = 'Scanned First Bottle ' + ScannedFirstBottle + ' Not Found On The System';
           
            let htmlpage = mustache.render(page, Data, frame);
			return res.send(htmlpage);
}
else{
let Arr = Resp.Arr;

if(Arr.length == 1){

    StnRec.ActivePatient = ScannedFirstBottle;
    PatientRec.Status = dec.PatientScriptStatus.Packed.value;

    Data.PatientData = true;
    Data.ProductionData = true;
    Data.InputData = true;
    Data.Reset = true;
    Data.Reprint = true;
    Data.StnActionData = true;
    Data.STN_MSG = 'This Patient Has One Bottle'
    Data.Production_Batch = Rec.Production_Batch;
    Data.Patient = PatientRec.Name+" "+PatientRec.Surname;
    Data.StnAction = 'CartonScan';
    Data.STN_ACTION = 'Scan Label Barcode';

    stn.Update(StnRec,function(Resp){
    });

    detail.Update(PatientRec,function(Resp){
    });

    let htmlpage = mustache.render(page, Data, frame);
    return res.send(htmlpage);
}
else{
    PatientRec.Status = dec.PatientScriptStatus.Packed.value;
   
    Data.PatientData = true;
    Data.ProductionData = true;
    Data.InputData = true;
    Data.Reset = true;
    Data.StnActionData = true;
    Data.Production_Batch = Rec.Production_Batch;
    Data.Patient = PatientRec.Name+" "+PatientRec.Surname;
    Data.StnAction = 'SecondPatientBottleScan';
    Data.STN_ACTION = 'Scan 2nd Patient Bottle';

    stn.Update(StnRec,function(Resp){
    });

    detail.Update(PatientRec,function(Resp){
    });

    let htmlpage = mustache.render(page, Data, frame);
    return res.send(htmlpage);
}
}
});
    });

}

router.get('/API/FirstPatientBottleScan', html.requireLogin, function(req, res){
	html.WEB_CallPageRedirect(res, '/API/packingstation');
});


router.post('/API/FirstPatientBottleScan', html.requireLogin, function(req, res){
	ExtractScannedTote(req, function(Resp){
		if(!Resp){
			req.session.Err = 'Please scan a valid first patient bottle';
			return html.WEB_CallPageRedirect(res, '/API/packingstation');
		}

		if(!Resp.Input){
			req.session.Err = 'Please scan a valid first patient bottle';
			return html.WEB_CallPageRedirect(res, '/API/packingstation');
		}

		req.session.scannedfirstbottle = Resp.Input;
		html.WEB_CallPageRedirect(res, '/API/packingstation');
	});
});

function ProcessStationReset(StnRec, loggedInUser, frame, page, Data, req, res){


    StnRec.ActivePatient = null;
	StnRec.CartonID = null;


		stn.Update(StnRec, function(Resp){
			StnRec = Resp.SavedDoc;
			return WhereToNext(StnRec,Rec, loggedInUser, frame, page, Data, req, res);
		});

} 

function ExtractScannedTote(req, callback){
	let form = new formidable.IncomingForm();

	form.parse(req, function (err, fields, files){
		if(fields.Input){
			return callback({Input: fields.Input});
		}

		return callback({Input: null});
	});
} 

function ProcessWCSStatus(ScannedCarton,Rec,PatientRec){

 detail.FindOne({'Parcel_Ref':ScannedCarton,'Production_Batch':Rec.Production_Batch,'File_No':PatientRec.File_No},function(Resp){
    if(!Resp.Rec){
        return;
    }
    let PatientRec = Resp.Rec;

    detail.Find({'File_No':PatientRec.File_No},function(Resp){
        if(!Resp.Arr){
            return;
        }
        let Arr = Resp.Arr;
        let x = 0;
        while(x<Arr.length){
            Arr[x].WCSStatus = dec.PatientScriptStatus.Packed.value;

            stn.Update(Arr[x],function(Resp){
            });
            x++;
        }
        
        Rec.Processed++;
    
        header.Update(Rec,function(Resp){
        });
    });
 });
}

//SECOND PATIENT BOTTLE
function ProcessSecondPatientBottleScanned(ScannedSecondBottle,Rec, StnRec, loggedInUser, frame, page, Data, req, res){
    Data.STN_ACTION = 'Scan 2nd Patient Bottle';
	Data.StnAction = 'SecondPatientBottleScan';

    if(!Rec){
        return;
    }
   
    detail.FindOne({'Script_Number':StnRec.ActivePatient},function(Resp){
        let PatientRec = Resp.Rec;

    detail.FindOne({'Script_Number':ScannedSecondBottle,'Production_Batch':Rec.Production_Batch,'Name':PatientRec.Name,'Surname':PatientRec.Surname},function(Resp){
        if(!Resp.Rec){
            Data.STN_MSG = 'Scanned Second Bottle ' + ScannedSecondBottle + ' Does Not Match Active Patient';
           
            let objTrayReject = {};

            objTrayReject.Script_Number = ScannedSecondBottle;
            objTrayReject.Reason = 'This bottle did not match the next bottle coming from the labeller';

            trayReject.New(objTrayReject,function(Resp){
            });

            let htmlpage = mustache.render(page, Data, frame);
			return res.send(htmlpage);
        }else{

        let PatientRec = Resp.Rec;
      
        PatientRec.Status = dec.PatientScriptStatus.Packed.value;

            detail.Update(PatientRec,function(Resp){
            });

            Data.PatientData = true;
            Data.ProductionData = true;
            Data.InputData = true;
            Data.Reset = true;
            Data.Reprint = true;
            Data.StnActionData = true;
            Data.Production_Batch = Rec.Production_Batch;
            Data.Patient = PatientRec.Name+" "+PatientRec.Surname;
            Data.StnAction = 'CartonScan';
            Data.STN_ACTION = 'Scan Label Barcode';
    
            let htmlpage = mustache.render(page, Data, frame);
            return res.send(htmlpage);
        }
    });
     });

    router.get('/API/SecondPatientBottleScan', html.requireLogin, function(req, res){
        html.WEB_CallPageRedirect(res, '/API/packingstation');
    });
}

router.get('/API/SecondPatientBottleScan', html.requireLogin, function(req, res){
	html.WEB_CallPageRedirect(res, '/API/packingstation');
});

router.post('/API/SecondPatientBottleScan', html.requireLogin, function(req, res){
	ExtractScannedTote(req, function(Resp){
		if(!Resp){
			req.session.Err = 'Please scan a valid second patient bottle';
			return html.WEB_CallPageRedirect(res, '/API/packingstation');
		}

		if(!Resp.Input){
			req.session.Err = 'Please scan a valid second patient bottle';
			return html.WEB_CallPageRedirect(res, '/API/packingstation');
		}

		req.session.scannedsecondbottle = Resp.Input;
		html.WEB_CallPageRedirect(res, '/API/packingstation');
	});
});

//CARTON PATIENT SCAN
function ProcessCartonScanned(ScannedCarton,Rec, StnRec, loggedInUser, frame, page, Data, req, res){
    Data.STN_ACTION = 'Scan Label Barcode';
	Data.StnAction = 'CartonScan';

    if(!Rec){
        return;
    }

    detail.FindOne({'Script_Number':StnRec.ActivePatient},function(Resp){
        let Record = Resp.Rec;
    detail.FindOne({'Parcel_Ref':ScannedCarton,'Production_Batch':Rec.Production_Batch,'File_No': Record.File_No},function(Resp){
        if(!Resp.Rec){
            Data.STN_MSG = 'Scanned Carton ' + ScannedCarton + ' Does Not Match Active Patient Or Not Found On The System';
           

            Data.STN_ACTION = 'Scan Label Barcode';
	        Data.StnAction = 'CartonScan';

            let htmlpage = mustache.render(page, Data, frame);
			return res.send(htmlpage);
        }
        else{

        PatientRec = Resp.Rec

        Data.ProductionData = true;
        Data.InputData = true;
        Data.StnActionData = true;
        Data.Production_Batch = Rec.Production_Batch;
        Data.STN_ACTION = 'Scan 1st Patient Bottle';
        Data.StnAction = 'FirstPatientBottleScan';

        ProcessWCSStatus(ScannedCarton,Rec,PatientRec);
        
        StnRec.CartonID = ScannedCarton;
        StnRec.ActivePatient = null;

        let number =1;
        tray.FindOne({'Collection_Point_Ref':PatientRec.Collection_Point_Ref},function(Resp){
            if(!Resp.Rec){
                return;
            }
            let TrayRec = Resp.Rec;

            if(PatientRec.Collection_Point_Ref != TrayRec.Collection_Point_Ref){
                number = number+1;
            }

        });
         
                let objTray = {};
                objTray.File_No=PatientRec.File_No;
                objTray.Collection_Point_Ref=PatientRec.Collection_Point_Ref;
                objTray.Collection_Point=PatientRec.Collection_Point;
                objTray.Tray=number;
                objTray.Status=PatientRec.Status;
                objTray.Production_Batch=PatientRec.Production_Batch;
               
                tray.New(objTray,function(Resp){
                });

        stn.Update(StnRec,function(Resp){
        });

        let htmlpage = mustache.render(page, Data, frame);
        return res.send(htmlpage);
    }
    });
});
    router.get('/API/CartonScan', html.requireLogin, function(req, res){
        html.WEB_CallPageRedirect(res, '/API/packingstation');
    });
}

router.get('/API/CartonScan', html.requireLogin, function(req, res){
	html.WEB_CallPageRedirect(res, '/API/packingstation');
});


router.post('/API/CartonScan', html.requireLogin, function(req, res){
	ExtractScannedTote(req, function(Resp){
		if(!Resp){
			req.session.Err = 'Please scan a valid carton scan';
			return html.WEB_CallPageRedirect(res, '/API/packingstation');
		}

		if(!Resp.Input){
			req.session.Err = 'Please scan a valid carton scan';
			return html.WEB_CallPageRedirect(res, '/API/packingstation');
		}

		req.session.scannedcarton = Resp.Input;
		html.WEB_CallPageRedirect(res, '/API/packingstation');
	});
});

router.get('/API/PackingStationReset', html.requireLogin, function (req, res){
	console.log('Reset button Action....');

	req.session.stationreset = true;
	html.WEB_CallPageRedirect(res, '/API/packingstation');
});

router.get('/API/PackingStationReprintDoc', function (req, res){
	console.log('Reprint button Action....');

	req.session.stationreprint = true;
	html.WEB_CallPageRedirect(res, '/API/packingstation');
});
module.exports = router;
