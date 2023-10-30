var express        		= require('express');
var mustache       		= require('mustache');
var moment 		   		= require('moment')
var formidable     		= require('formidable');
var async          		= require('async');
var router         		= express.Router();
var Chart 		   		= require('chart')
var UserLib        		= require('../../../lib/classUser');
var HtmlLib	       		= require('../../../lib/classHtml');
var LogLib	            = require('../../../lib/classLogging');


var dec                 = require('../../../lib/declaration');


var html           		= new HtmlLib();
var user           		= new UserLib();
var log 		        = new LogLib();



function ShowDash(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('dash');
	let Data = html.GetEmptyPage(loggedInUser);

	Data.PickingCollapse = 'collapse';

    if(Resp){
		Data.PicksPerHour = Resp.TodaySummary.PrintsPerHour

		if(!req.session.pphsumdate){
			Data.PickingToday = ' | Date: ' + moment(new Date()).format('DD-MM-YYYY');
		} else {
			Data.PickingToday = ' | Date: ' + req.session.pphsumdate;
			Data.PickingCollapse = '';
			delete req.session.pphsumdate;
		}

		Data.orderList  = Resp.PlSummary;
		Data.Today = moment(new Date()).format('DD-MM-YYYY');

		if(Resp.AEs){
			if(Resp.AEs.length > 10){
				let LessData = [];
				let z = 0;
				while(z < 10){
					LessData.push(Resp.AEs[z]);
					z++;
				}

				Data.Record = LessData;
			} else {
				Data.Record = Resp.AEs;
			}
			Data.Count = Resp.AEs.length;
			Data.AE = true;
		}
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowDash */

function GetUserSummary(date, callback){
	userstats.Find({'CreateDate': date}, function(Resp){
		return callback(Resp);
	});
} /* GetUserSummary */

function GetPickingSummary(date, callback){
	let PicksPerHour = [];
	let PicksPerHourDesc = ["00","01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23"];
	let x = 0;
	while(x < 24){
		PicksPerHour.push(0);
		x++;
	}

	let Cursor = orders.FindStream({'ship_date': {"$regex" : ".*" + date + ".*"}});

	Cursor.on('data', function(PL) {
		Cursor.pause();
		let EndDate = PL.ship_date;
		let TimeArr = EndDate.split(' ');
		let Time = TimeArr[1];
		let HourArr = Time.split(':');
		let Hour = HourArr[0];
		let x = PicksPerHourDesc.indexOf(Hour);
		if(x >= 0){
			PicksPerHour[x]++;
		}
		Cursor.resume();
	});

	Cursor.on('error', function(err) {
		return callback({Err: err});
	});

	Cursor.on('end', function() {
		return callback({PicksPerHour: PicksPerHour});
	});
} /* GetPickingSummary */

function GetTodaySummary(date, callback){
	let PicksPerHour = [];
	let PicklistPerHour = [];
	let Desc = ["00","01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23"];
	let x = 0;
	while(x < 24){
		PicksPerHour.push(0);
		PicklistPerHour.push(0);
		x++;
	}

	let PStack = {};
	PStack.PrintsPerHour = function(callback){
		let Cursor = orders.FindStream({'ship_date': {"$regex" : ".*" + date + ".*"}});

		Cursor.on('data', function(PL) {

			Cursor.pause();
			let EndDate = PL.ship_date;

			let TimeArr = EndDate.split(' ');
			let Time = TimeArr[1];
			let HourArr = Time.split(':');
			let Hour = HourArr[0];
			let x = Desc.indexOf(Hour);
			if(x >= 0){
				PicksPerHour[x]++;
			}
			Cursor.resume();
		});

		Cursor.on('error', function(err) {
			return callback(err, null);
		});

		Cursor.on('end', function() {
			return callback(null, PicksPerHour);
		});
	}

	PStack.PicklistPerHour = function(callback){
		let PCursor = orders.FindStream({'print_date': {"$regex" : ".*" + date + ".*"}});

		PCursor.on('data', function(PPL) {
			PCursor.pause();
			let CreateDate = PPL.print_date;
			let TimeArr = CreateDate.split(' ');
			let Time = TimeArr[1];
			let HourArr = Time.split(':');
			let Hour = HourArr[0];
			let x = Desc.indexOf(Hour);
			if(x >= 0){
				PicklistPerHour[x]++;
			}
			PCursor.resume();
		});

		PCursor.on('error', function(err) {
			return callback(err, null);
		});

		PCursor.on('end', function() {
			return callback(null, PicklistPerHour);
		});
	}

	async.parallel(PStack, function(err, Result){
		return callback({Err: err, Data: Result});
	});
} /* GetTodaySummary */

function diff_minutes(dt2, dt1){
	let diff =(dt2.getTime() - dt1.getTime()) / 1000;
	diff /= 60;

	return Math.abs(Math.round(diff));
} /* diff_minutes */

function GetAEsForUser(UserID, callback){
	let ulist = [];
	ulist.push(UserID);
	ae.Find({'UsersViewed':{$nin: ulist}}, function(Resp){
		return callback(Resp);
	});
} /* GetAEsForUser */

router.get('/API/dashboard', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;
	ShowDash(null, loggedInUser, req, res);
	
});

router.get('/API/dashboardchangedate', html.requireLogin, function (req, res){
	let pphDate = req.query.pphDate;

	if(pphDate){
		console.log(pphDate);
		let DD = new Date(pphDate);
		console.log(DD);
		pphDate = moment(pphDate).format('YYYY-MM-DD');
		console.log(pphDate);
		req.session.pphsumdate = pphDate;
	}

	return html.WEB_CallPageRedirect(res, '/API/dashboard');
});

router.post('/API/dashGetAverageData', html.requireLogin, function (req, res){
	
	let loggedInUser = req.session.username;
	
	detail.DtGetData(req, loggedInUser, function(Resp){
		
		let chartLabels = [];
		let chartValues = [];
		
		dec.PatientScriptStatus.enums.forEach(function(enumItem) {
		  chartLabels.push(enumItem.key);
		  chartValues.push(enumItem);
		});
		
		let x = 0;
		
		let Obj = JSON.parse(Resp);
		
		let MyData = Obj.data;

		let ListData = [];
		

		
		while(x < chartLabels.length){
			
			let y = 0;
			
			let StatusCount = 0;
			
			while(y < MyData.length){
				
				let StrStatus = MyData[y].Status;
				
				if(chartLabels[x] == StrStatus){
					StatusCount++;
				}
				y++;
			}
			
			chartValues[x] = StatusCount;

			let results=(chartLabels[x] + ' : ' + chartValues[x]);
			
		
			let myData=chartValues[x];
	 
			ListData.push(myData);
			
           // console.log(myData);
			
			x++;	
		}
		let data = JSON.stringify({
			   "data":ListData});
			   
		res.send(data);
		
	});
});

router.post('/API/dashGetSpecificData', html.requireLogin, function (req, res){
	
	let loggedInUser = req.session.username;
	
	header.DtGetData(req, loggedInUser, function(Resp){

		let Obj = JSON.parse(Resp);
		
		let MyData = Obj.data;
		
		let ListData = CalculateCountsPerStatus(MyData);

		let data = JSON.stringify({
			   "data":ListData});
			   
		res.send(data);
		
	});
		
});

function CalculateCountsPerStatus(DetailData){
	let ListData = [];

	let chartLabels = [];
	let chartValues = [];
	
	dec.PatientScriptStatus.enums.forEach(function(enumItem) {
	  chartLabels.push(enumItem.key);
	  chartValues.push(enumItem);
	});
	
	let x = 1;
	
	while(x < chartLabels.length){
		
		let y = 0;
		
		let StatusCount = 0;
		
		while(y < DetailData.length){
			
			let StrStatus = DetailData[y].Status;
			
			if(chartLabels[x] == StrStatus){
				StatusCount++;
			}
			y++;
		}
		
		chartValues[x] = StatusCount;

		let results=(chartLabels[x] + ' : ' + chartValues[x]);
		
		let myData=chartValues[x] + ' : ' + chartValues[x];

		ListData.push(myData);	
						
		x++;	
	}	
	
	return ListData;
} /* CalculateCountsPerStatus */

router.post('/API/dashGetSpecificDataCount', html.requireLogin, function (req, res){
	
	if(!req.session || !req.session.username){
		return res.send({Msg: "Session Expired"});
	}

	let loggedInUser = req.session.username;

	

	header.Find({$and: [{'Status': {$gte: dec.BatchStatus.Assigned.value}}, {'Status': {$lt: dec.BatchStatus.Shipped.value}}]},function(Resp){

		 let Arr = Resp.Arr;

		 let BatchID = '';
		 
		 //let ListData=[];
		 
		 let BatchRecNo = -1;
		 let x = 0;
		 while(x < Arr.length){
			 if(BatchRecNo == -1){
				 BatchRecNo = x;
			 }
 
			 if(BatchRecNo >= 0){
				 let CurrLastUpdate = new Date(Arr[BatchRecNo].LastUpdate);
				 let BatchLastUpdate = new Date(Arr[x].LastUpdate);
				 
				 if(BatchLastUpdate > CurrLastUpdate){
					 BatchRecNo = x;
				 }
			 }
			
			 x++;
		 }
		 
		 if(BatchRecNo >= 0){
			 
			BatchID = Arr[BatchRecNo].BatchID;
		
		 }
		 
		 let data = '';
		 
		 if(!BatchID){
			console.log("No batch found in required status"); 
			return res.send(data);
		 }
		 
		detail.Find({'BatchID': BatchID}, function(Resp){
			if(!Resp.Arr){
				console.log("No detail data found for given batch: " + BatchID);
				return res.send(data);	
				
			}
			
			if(Resp.Arr.length <= 0){
				console.log("No detail data found for given batch: " + BatchID);
				return res.send(data);
			}
			
			var MyData = Resp.Arr;
			
			
			let chartLabels = [];
		    let chartValues = []; 
			
		 dec.BatchStatus.enums.forEach(function(enumItem) {
			 
		  chartLabels.push(enumItem);
		  chartValues.push();
		  
		});
		
		let x=1;
		
		let ListData=[];
		
		while(x < chartLabels.length){
			
			let y = 0;
			
			let StatusCount = 0;
			
			while(y < MyData.length){
				
				let StrStatus = MyData[y].Status;
				
				if(chartLabels[x] == StrStatus){
					StatusCount++;
				}
				y++;
			}
			
			chartValues[x] = StatusCount;

			let results=(chartLabels[x] + ' : ' + chartValues[x]);
			
			ListData.push(chartValues[x]);	
		
			x++;	
		}
		let data = JSON.stringify({
			   "data":ListData});
			   
		   res.send(data);
		  
		});
	});	
});


module.exports = router;
