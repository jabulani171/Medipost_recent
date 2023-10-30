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
var StnLib         = require('../../../lib/classShippingStation');
var BatchHeaderLib = require('../../../lib/classBatchSummary');
var TrayLib        = require('../../../lib/classTray');
const { Console } = require('console');

var router         = express.Router();
var html           = new HtmlLib();
var stn            = new StnLib();
var header         = new BatchHeaderLib();
var tray           = new TrayLib();

PublishClient      = redis.createClient();
var CartonsNum = 0;

function ShowShippingStationScreen(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	let StnIP = null;
	frame.ext = html.GetPage('shipping');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('OperateShippingStation') >= 0){
		Data.Granted = true;
	}

    if(Data.Granted){
		StnIP = html.GetIpAddress(req);
		
		stn.FindOne({'Shipping_Station_IP':StnIP},function(Resp){
            if(!Resp.Rec){
				Data.StnIP = StnIP;

				let htmlpage = mustache.render(page, Data, frame);
				return res.send(htmlpage);
			}
			else{
			StnRec = Resp.Rec;
			Data.Station = StnRec.Shipping_Station_ID;
			
			header.FindOne({'Status':dec.BatchStatus.Packed.value},function(Resp){
				if(!Resp.Rec){
					Data.ProductionData = false;
                    Data.PatientData = false;
                    Data.STN_MSG = 'No Batch Packed';
                    Data.Configured = true;

					let htmlpage = mustache.render(page, Data, frame);
                    res.send(htmlpage);
				}
				else{
				let BatchRec = Resp.Rec;
				Data.Configured = true;
				if(req.session.scannedfirstpatientcarton){
                    let ScannedFirstPatientCarton = req.session.scannedfirstpatientcarton;
                    delete req.session.scannedfirstpatientcarton;
                 
                    return ProcessFirstPatientCartonScanned(ScannedFirstPatientCarton,BatchRec, StnRec, loggedInUser, frame, page, Data, req, res);
                }

				if(req.session.scannedlabelbarcode){
                    let ScannedLabelBarcode = req.session.scannedlabelbarcode;
                    delete req.session.scannedlabelbarcode;
                 
                    return ProcessLabelBarcodeScanned(ScannedLabelBarcode,BatchRec, StnRec, loggedInUser, frame, page, Data, req, res);
                }

				if(req.session.scannedpatientcarton){
                    let ScannedPatientCarton = req.session.scannedpatientcarton;
                    delete req.session.scannedpatientcarton;
                 
                    return ProcessPatientCartonScanned(ScannedPatientCarton,BatchRec, StnRec, loggedInUser, frame, page, Data, req, res);
                }

				if(req.session.stationreset){
					delete req.session.stationreset;

					return ProcessStationReset(StnRec,BatchRec, loggedInUser, frame, page, Data, req, res);
				}
		
				return WhereToNext(StnRec,BatchRec, loggedInUser, frame, page, Data, req, res);
		}
			});	
		}	
		});
	}
} 

router.get('/API/shippingstation', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowShippingStationScreen(null, loggedInUser, req, res);
});

function WhereToNext(StnRec,BatchRec, loggedInUser, frame, page, Data, req, res){

	let ActiveWaybill = StnRec.ActiveWaybill;

if(!BatchRec){
	return;
}



if(StnRec.ActiveWaybill){

	if(StnRec.ProcessedCartons == 1){

		Data.ProductionData = true;
				Data.InputData = true;
				Data.StationActionData = true;
				Data.Reset = true;
				Data.Reprint = true;
				Data.Production_Batch = BatchRec.Production_Batch;
				Data.STATION_ACTION = 'Scan Label Barcode';
				Data.StationAction = 'LabelBarcodeScan';
	
				let htmlpage = mustache.render(page, Data, frame);
			return res.send(htmlpage);
	
	}
	else{	
if(StnRec.ProcessedCartons == StnRec.Cartons){
	Data.ProductionData = true;
	Data.StationActionData = true;
	Data.ActiveWaybillData = true;
	Data.CartonsData = true;
	Data.CompleteData = true;
	Data.Production_Batch = BatchRec.Production_Batch;
	Data.ActiveWaybill = ActiveWaybill;
	Data.Cartons = StnRec.ProcessedCartons;
	Data.CartonsTotal = StnRec.Cartons; 


	let htmlpage = mustache.render(page, Data, frame);
		return res.send(htmlpage);
}

		
		}

}else{

	tray.Find({'Status':{$gte:dec.BatchStatus.Packed.value},'Production_Batch':BatchRec.Production_Batch},function(Resp){
		if(!Resp.Arr){
			Data.STN_MSG = 'No Patients Packed Packed';

			let htmlpage = mustache.render(page, Data, frame);
			res.send(htmlpage);
		}
		else{

		
			Data.ProductionData = true;
			Data.InputData = true;
			Data.StationActionData = true;
			Data.Production_Batch = BatchRec.Production_Batch;
			Data.STATION_ACTION = 'Scan 1st Patient Bottle';
			Data.StationAction = 'FirstPatientCartonScan';
	
			let htmlpage = mustache.render(page, Data, frame);
				return res.send(htmlpage);
		}
		});
	
	}
}

function ProcessFirstPatientCartonScanned(ScannedFirstPatientCarton,BatchRec, StnRec, loggedInUser, frame, page, Data, req, res){
	Data.STATION_ACTION = 'Scan 1st Patient Bottle';
	Data.StationAction = 'FirstPatientCartonScan';

	tray.FindOne({'File_No':ScannedFirstPatientCarton},function(Resp){
		if(!Resp.Rec){
		Data.STN_MSG = 'Scanned First Patient ' + ScannedFirstPatientCarton + ' Not Found In The System';

		let htmlpage = mustache.render(page, Data, frame);
		res.send(htmlpage);
		}
		else{
			let  TrayRec = Resp.Rec;

			tray.Find({'Collection_Point':TrayRec.Collection_Point,'Production_Batch':BatchRec.Production_Batch},function(Resp){
				if(!Resp.Arr){
					Data.STN_MSG = 'Scanned Patient Carton ' + TrayRec.Collection_Point + ' Not Found In The System';
				   
					let htmlpage = mustache.render(page, Data, frame);
					return res.send(htmlpage);
				}
				let Arr = Resp.Arr
		
				if(TrayRec.Status > dec.BatchStatus.Packed.value){
					Data.STN_MSG = 'Scanned Patient Carton ' + ScannedFirstPatientCarton + ' Already shipped';
				   
					let htmlpage = mustache.render(page, Data, frame);
					return res.send(htmlpage);
				}
				else{


					
			
					StnRec.ProcessedCartons = StnRec.ProcessedCartons +1;

					if( StnRec.ProcessedCartons == 1){
						Data.ProductionData = true;
						Data.InputData = true;
						Data.StationActionData = true;
						Data.Reset = true;
						Data.Reprint = true;
						Data.Production_Batch = BatchRec.Production_Batch;
						Data.STATION_ACTION = 'Scan Label Barcode';
						Data.StationAction = 'LabelBarcodeScan';

						
						StnRec.ActiveWaybill = TrayRec.Collection_Point;
						StnRec.Cartons = Arr.length; 
			
						stn.Update(StnRec,function(Resp){
						});
		
						TrayRec.Status = dec.BatchStatus.Shipped.value;
						tray.Update(TrayRec,function(Resp){
						})
				
				let htmlpage = mustache.render(page, Data, frame);
					return res.send(htmlpage);
					}
					else{

						if(StnRec.ProcessedCartons == StnRec.Cartons){
							Data.ProductionData = true;
							Data.ActiveWaybillData = true;
							Data.CartonsData = true;
							Data.CompleteData = true;
							Data.Production_Batch = BatchRec.Production_Batch;
							Data.ActiveWaybill = StnRec.ActiveWaybill;
							Data.Cartons = StnRec.ProcessedCartons;
							Data.CartonsTotal = StnRec.Cartons; 
						
							let htmlpage = mustache.render(page, Data, frame);
								return res.send(htmlpage);
						}
						else{
							Data.ProductionData = true;
							Data.InputData = true;
							Data.StationActionData = true;
							Data.ActiveWaybillData = true;
							Data.CartonsData = true;
							Data.Production_Batch = BatchRec.Production_Batch;
							Data.ActiveWaybill = TrayRec.Collection_Point;
							Data.Cartons = StnRec.ProcessedCartons;
							Data.CartonsTotal =Arr.length; 
							Data.STATION_ACTION = 'Scan Patient Carton';
							Data.StationAction = 'PatientCartonScan';
				
							StnRec.ActiveWaybill = TrayRec.Collection_Point;
							StnRec.Cartons = Arr.length; 
				
							stn.Update(StnRec,function(Resp){
							});
			
							TrayRec.Status = dec.BatchStatus.Shipped.value;
							tray.Update(TrayRec,function(Resp){
							})
					
					let htmlpage = mustache.render(page, Data, frame);
						return res.send(htmlpage);
						}
					
					}

			

				}
			});
		}
	});
}

router.get('/API/FirstPatientCartonScan', html.requireLogin, function(req, res){
	html.WEB_CallPageRedirect(res, '/API/shippingstation');
});

router.post('/API/FirstPatientCartonScan', html.requireLogin, function(req, res){
	ExtractScannedTote(req, function(Resp){
		if(!Resp){
			req.session.Err = 'Please scan a valid first patient bottle';
			return html.WEB_CallPageRedirect(res, '/API/shippingstation');
		}

		if(!Resp.Input){
			req.session.Err = 'Please scan a valid first patient bottle';
			return html.WEB_CallPageRedirect(res, '/API/shippingstation');
		}

		req.session.scannedfirstpatientcarton = Resp.Input;
		html.WEB_CallPageRedirect(res, '/API/shippingstation');
	});
});

function ProcessStationReset(StnRec,BatchRec, loggedInUser, frame, page, Data, req, res){

	StnRec.Cartons = null;
	StnRec.ActiveWaybill = null;
	StnRec.ProcessedCartons = null;

	
		stn.Update(StnRec, function(Resp){
			return WhereToNext(StnRec,BatchRec, loggedInUser, frame, page, Data, req, res);
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
function ProcessLabelBarcodeScanned(ScannedLabelBarcode,BatchRec, StnRec, loggedInUser, frame, page, Data, req, res){
	Data.STATION_ACTION = 'Scan Label Barcode';
	Data.StationAction = 'LabelBarcodeScan';

	tray.FindOne({'Collection_Point_Ref':ScannedLabelBarcode},function(Resp){
		if(!Resp.Rec){
			Data.STN_MSG = 'Scanned Label Barcode ' + ScannedLabelBarcode + ' Not Found In The System';
	
			let htmlpage = mustache.render(page, Data, frame);
			res.send(htmlpage);
			}
			else{
				let TrayRec = Resp.Rec;
				tray.Find({'Collection_Point':TrayRec.Collection_Point},function(Resp){
					if(!Resp.Arr){
						
							Data.STN_MSG = 'No Data Found ';
						   
							let htmlpage = mustache.render(page, Data, frame);
							return res.send(htmlpage);
					}
					else{
						let Arr = Resp.Arr;

						Data.ProductionData = true;
						Data.InputData = true;
						Data.StationActionData = true;
						Data.ActiveWaybillData = true;
						Data.CartonsData = true;
						Data.Production_Batch = BatchRec.Production_Batch;
						Data.ActiveWaybill = TrayRec.Collection_Point;
						Data.Cartons = StnRec.ProcessedCartons;
						Data.CartonsTotal = Arr.length; 
						Data.STATION_ACTION = 'Scan Patient Carton';
						Data.StationAction = 'PatientCartonScan';

						let htmlpage = mustache.render(page, Data, frame);
					return res.send(htmlpage);
					}
				});
	
			}
	});
}

router.get('/API/LabelBarcodeScan', html.requireLogin, function(req, res){
	html.WEB_CallPageRedirect(res, '/API/shippingstation');
});

router.post('/API/LabelBarcodeScan', html.requireLogin, function(req, res){
	ExtractScannedTote(req, function(Resp){
		if(!Resp){
			req.session.Err = 'Please scan a valid first patient bottle';
			return html.WEB_CallPageRedirect(res, '/API/shippingstation');
		}

		if(!Resp.Input){
			req.session.Err = 'Please scan a valid first patient bottle';
			return html.WEB_CallPageRedirect(res, '/API/shippingstation');
		}

		req.session.scannedlabelbarcode = Resp.Input;
		html.WEB_CallPageRedirect(res, '/API/shippingstation');
	});
});


function ProcessPatientCartonScanned(ScannedPatientCarton,BatchRec, StnRec, loggedInUser, frame, page, Data, req, res){
	Data.STATION_ACTION = 'Scan Patient Carton';
    Data.StationAction = 'PatientCartonScan';

	tray.FindOne({'File_No':ScannedPatientCarton},function(Resp){
		if(!Resp.Rec){
			Data.STN_MSG = 'Scanned Patient Carton ' + ScannedPatientCarton + ' Not Found In The System';
	
			let htmlpage = mustache.render(page, Data, frame);
			res.send(htmlpage);
			}
			else{
				let TrayRec = Resp.Rec;

				tray.Find({'Collection_Point':TrayRec.Collection_Point},function(Resp){
					if(!Resp.Arr){
						
						Data.STN_MSG = 'No Data Found ';
					   
						let htmlpage = mustache.render(page, Data, frame);
						return res.send(htmlpage);
				}
				else{

				
let Arr = Resp.Arr;

						Data.ProductionData = true;
						Data.InputData = true;
						Data.StationActionData = true;
						Data.ActiveWaybillData = true;
						Data.CartonsData = true;
						Data.Production_Batch = BatchRec.Production_Batch;
						Data.ActiveWaybill = TrayRec.Collection_Point;
						Data.Cartons = StnRec.ProcessedCartons;
						Data.CartonsTotal = Arr.length; 
						Data.STATION_ACTION = 'Scan Patient Carton';
						Data.StationAction = 'PatientCartonScan';

						let htmlpage = mustache.render(page, Data, frame);
						return res.send(htmlpage);
					

					
				}
				});
			}
	})
}

router.get('/API/PatientCartonScan', html.requireLogin, function(req, res){
	html.WEB_CallPageRedirect(res, '/API/shippingstation');
});

router.post('/API/PatientCartonScan', html.requireLogin, function(req, res){
	ExtractScannedTote(req, function(Resp){
		if(!Resp){
			req.session.Err = 'Please scan a valid first patient bottle';
			return html.WEB_CallPageRedirect(res, '/API/shippingstation');
		}

		if(!Resp.Input){
			req.session.Err = 'Please scan a valid first patient bottle';
			return html.WEB_CallPageRedirect(res, '/API/shippingstation');
		}

		req.session.scannedfirstpatientcarton = Resp.Input;
		html.WEB_CallPageRedirect(res, '/API/shippingstation');
	});
});

router.get('/API/ShippingStationReset', html.requireLogin, function (req, res){
	console.log('Reset button Action....');

	req.session.stationreset = true;
	html.WEB_CallPageRedirect(res, '/API/shippingstation');
});

router.get('/API/ShippingStationReprintDoc', function (req, res){
	console.log('Reprint button Action....');

	req.session.stationreprint = true;
	html.WEB_CallPageRedirect(res, '/API/shippingstation');
});

router.get('/API/ShippingStationCompleteShipper', function (req, res){
	console.log('Complete Shipper button Action....');

	req.session.stationcompleteshipper = true;
	html.WEB_CallPageRedirect(res, '/API/shippingstation');
});
module.exports = router;
