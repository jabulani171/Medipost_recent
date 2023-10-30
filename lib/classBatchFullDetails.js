var db          = require('../db_schema/batchFullDetails');
var dec         = require('../lib/declaration');
var moment      = require('moment');



function _DtGetData(req, loggedInUser, callback){
	
	let searchStr = {};

	let strSearch = req.body['search[value]'];
    
	let strSort = req.body['order[0][column]'];
	let SortIndex = 'columns['+ strSort +'][data]';
	let SortValue = req.body[SortIndex];
	let strSortDir = req.body['order[0][dir]'];
	let SortDir = -1;

	if(strSortDir == 'asc'){
		SortDir = 1;
	}

	let strSysSort = '{"' + SortValue + '":' + SortDir + '}';
	let SysSort = JSON.parse(strSysSort);

	if(strSearch){
		let regex = new RegExp(strSearch, "i");

		
let Filters =  [{'Production_Batch': regex},
{'Print_Batch': regex},
{'Client_Name': regex},
{'Client_Address': regex},
{'Double_Dispensing_Indicator': regex},
{'Date_Dispensed': regex},
{'Script_Number': regex},
{'Item_Count': regex},
{'Drug_Description': regex},
{'Dosage_Line_1': regex},
{'Dosage_Line_2': regex},
{'Dosage_Line_3': regex},
{'Dosage_Line_4': regex},
{'Title': regex},
{'Initials': regex},
{'Surname': regex},
{'Repeat': regex},
{'Pharmacist': regex},
{'File_No': regex},
{'Batch': regex},
{'Expiry': regex},
{'Lane': regex},
{'FCY': regex},
{'SQ': regex},
{'Order_No': regex},
{'Line_No': regex},
{'Hospital_Ref': regex},
{'Production_Batch_1': regex},
{'Production_Batch_2': regex},
{'Production_Expiry': regex},
{'Name': regex},
{'Fridge': regex},
{'SSEQ': regex},
{'Date_Of_Birth': regex},
{'Cell_No': regex},
{'ID_Number': regex},
{'Collection_Date': regex},
{'Next_Collection_Date': regex},
{'Collection_Point': regex},
{'Profile_No': regex},
{'Repeat_Notice': regex},
{'Following_Items_Not_Included': regex},
{'Line_1': regex},
{'Line_2': regex},
{'Line_3': regex},
{'Line_4': regex},
{'Facility_Review': regex},                    
{'Parcel_Ref': regex},
{'Collection_Point_Ref': regex},
{'MpNo': regex},
{'Hub': regex},
{'Zone': regex},
{'Second_Rx_Ref': regex},
{'Parcel_Reference_Number': regex}, 
{'MAN_SEQ': regex},
{'SEQUENCE': regex},
{'CCMDD': regex},
{'Proxy_Name_1': regex},
{'Proxy_1_ID': regex},
{'Proxy_Name_2': regex},
{'Proxy_2_ID': regex},
{'WCSStatus': regex}];

                           
				        
if(!isNaN(strSearch)){
	Filters.push({'Status': Number(strSearch)});
	Filters.push({'Script_Number': Number(strSearch)});
	Filters.push({'Order_No': Number(strSearch)});
	Filters.push({'Profile_No': Number(strSearch)});
	Filters.push({'MpNo': Number(strSearch)});
	Filters.push({'WCSStatus': Number(strSearch)});
}

if(dec.PatientScriptStatus.get(strSearch)){
	let iStatus = dec.PatientScriptStatus.get(strSearch).value;
	Filters.push({'Status': iStatus});
}
                        searchStr = { $or: Filters};
                    
	}

	let Production_Batch = req.query.id;
	
    let all = {};


    if(Production_Batch){
		searchStr = { $and:[ {'Production_Batch': Production_Batch}, searchStr ] };
		all = {'Production_Batch': Production_Batch};
		
	}

	db.countDocuments(all, function (err, c) {
		let recordsTotal=c;
	
		db.countDocuments(searchStr, function(err, c) {
			let recordsFiltered=c;
			db.find(searchStr, 'Production_Batch Print_Batch Client_Name Client_Address Double_Dispensing_Indicator Date_Dispensed Script_Number Item_Count Drug_Description Dosage_Line_1 Dosage_Line_2 Dosage_Line_3 Dosage_Line_4 Title Initials Surname Repeat Pharmacist File_No Batch Expiry Lane FCY SQ Order_No Line_No Hospital_Ref Production_Batch_1 Production_Batch_2 Production_Expiry Name Fridge SSEQ Date_Of_Birth Cell_No ID_Number Collection_Date Next_Collection_Date Collection_Point Profile_No Repeat_Notice Following_Items_Not_Included Line_1 Line_2 Line_3 Line_4 Facility_Review Parcel_Ref Collection_Point_Ref MpNo Hub Zone Second_Rx_Ref Parcel_Reference_Number MAN_SEQ SEQUENCE Status created_at updated_at CCMDD Proxy_Name_1 Proxy_1_ID Proxy_Name_2 Proxy_2_ID WCSStatus',
							   {'skip': Number(req.body.start),
								'limit': Number(req.body.length),
								'sort': SysSort}, function (err, results) {
				         
					
				if (err) {
					console.log('error while getting results'+err);
					return callback(null);
				}      
				
				let ListData = [];
				let x = 0;
				while(x < results.length){
					let mData = {
						Production_Batch: results[x].Production_Batch,
						Print_Batch:results[x].Print_Batch,
						Client_Name:results[x].Client_Name,
						Client_Address: results[x].Client_Address,
						Double_Dispensing_Indicator: results[x].Double_Dispensing_Indicator,
						Date_Dispensed: results[x].Date_Dispensed,
						Script_Number: results[x].Script_Number,
						Item_Count: results[x].Item_Count,
						Drug_Description: results[x].Drug_Description,
						Dosage_Line_1: results[x].Dosage_Line_1,
						Dosage_Line_2: results[x].Dosage_Line_2,
						Dosage_Line_3: results[x].Dosage_Line_3,
						Dosage_Line_4: results[x].Dosage_Line_4,
						Title: results[x].Title,
						Initials: results[x].Initials,
						Surname: results[x].Surname,
						Repeat: results[x].Repeat,	
						Pharmacist: results[x].Pharmacist,
						File_No: results[x].File_No,
						Batch: results[x].Batch,
						Expiry: results[x].Expiry,
						Lane: results[x].Lane,
						FCY: results[x].FCY,
						SQ: results[x].SQ,
						Order_No: results[x].Order_No,
						Line_No: results[x].Line_No,
						Hospital_Ref: results[x].Hospital_Ref,
						Production_Batch_1: results[x].Production_Batch_1,
						Production_Batch_2: results[x].Production_Batch_2,
						Production_Expiry: results[x].Production_Expiry,
						Name: results[x].Name,
						Fridge: results[x].Fridge,
						SSEQ: results[x].SSEQ,
						Date_Of_Birth: results[x].Date_Of_Birth,
						Cell_No: results[x].Cell_No,
						ID_Number: results[x].ID_Number,
						Collection_Date: results[x].Collection_Date,
						Next_Collection_Date: results[x].Next_Collection_Date,
						Collection_Point: results[x].Collection_Point,
						Profile_No: results[x].Profile_No,                                       
						Repeat_Notice: results[x].Repeat_Notice,
						Following_Items_Not_Included: results[x].Following_Items_Not_Included,
						Line_1: results[x].Line_1,
						Line_2: results[x].Line_2,
						Line_3: results[x].Line_3,
						Line_4: results[x].Line_4,
						Facility_Review: results[x].Facility_Review,                    
						Parcel_Ref: results[x].Parcel_Ref,
						Collection_Point_Ref: results[x].Collection_Point_Ref,
						MpNo: results[x].MpNo,
						Hub: results[x].Hub,
						Zone: results[x].Zone,
						Second_Rx_Ref: results[x].Second_Rx_Ref,
						Parcel_Reference_Number: results[x].Parcel_Reference_Number, 
						MAN_SEQ: results[x].MAN_SEQ,
						SEQUENCE: results[x].SEQUENCE,
						Status: dec.PatientScriptStatus.get(results[x].Status).key,
						created_at: results[x].created_at,
						updated_at: results[x].updated_at,
						CCMDD: results[x].CCMDD,
						Proxy_Name_1: results[x].Proxy_Name_1,
						Proxy_1_ID: results[x].Proxy_1_ID,
						Proxy_Name_2: results[x].Proxy_Name_2,
						Proxy_2_ID: results[x].Proxy_2_ID,
						WCSStatus: results[x].WCSStatus
					
                    }

                    ListData.push(mData);
					x++;
                }
					let data = JSON.stringify({
                    "draw": req.body.draw,
                  "recordsFiltered": recordsFiltered,
                    "recordsTotal": recordsTotal,
                    "data": ListData
				});
			
				return callback(data);
			});
		});
	});
} /* _DtGetData */

function _CreateRecord(Object, callback){
	let Record = new db(Object);

	Record.save(function (err, savedDoc){
		return callback({Err:err, SavedDoc: savedDoc});
	});
} /* _CreateRecord */

function _ToCamelCase(str){
	return str.toLowerCase().replace(/(?:(^.)|(\s+.))/g, function(match){
		return match.charAt(match.length-1).toUpperCase();
	});
} /* ToCamelCase */
module.exports = class BatchFullDetails{
    constructor(){}

    DtGetData(req, loggedInUser, callback){
		_DtGetData(req, loggedInUser, function(Resp){
			return callback(Resp);
		});
	} /* DtGetData */

    New(Object, callback){
		_CreateRecord(Object, function(Resp){
			return callback(Resp);
		});
	} /* New */

	Delete(KeyValuePair, callback){
		db.remove(KeyValuePair, function(err, Resp){
			if(err){
				return callback({Err: err})
			}

			return callback({DeleteResp: Resp});
		});
	} /* Delete */

	DeleteRecord(KeyValuePair, callback){
		db.deleteOne(KeyValuePair, function(err, Resp){
			if(err){
				return callback({Err: err})
			}

			return callback({DeleteResp: Resp});
		});
	} /* DeleteRecord */

	Find(KeyValuePair, callback){
		db.find(KeyValuePair, function(err, Arr){
			if(err){
				return callback({Err: err});
			}

			if(Arr.length > 0){
				return callback({Arr: Arr});
			}

			return callback({Arr: null});
		});
	} /* Find */

	FindDistinct(KeyValuePair, callback){
		db.distinct(KeyValuePair, function(err, Arr){
			if(err){
				return callback({Err: err});
			}

			if(Arr.length > 0){
				return callback({Arr: Arr});
			}

			return callback({Arr: null});
		});
	} /* Find */

	FindOne(KeyValuePair, callback){
		db.findOne(KeyValuePair, function(err, Rec){
			if(err){
				return callback({Err: err});
			}

			if(!Rec){
				return callback({Rec: null});
			}

			return callback({Rec: Rec});
		});
	} /* FindOne */
	

	FormNewRecordObj(Obj, callback){

	} /* FormNewRecordObj */

	ToCamelCase(str){
		return _ToCamelCase(str);
	} /* ToCamelCase */

	Update(UpdateObject, callback){
		if(!UpdateObject){
			return callback({SavedDoc:null});
		}

		//UpdateObject.markModified('Fields');
		UpdateObject.save(function(err, savedDoc){
			return callback({SavedDoc: savedDoc});
		});
	} /* Update */

} /* BatchFullDetail */