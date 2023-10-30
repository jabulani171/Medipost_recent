var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var async          = require('async');
var moment 		   = require('moment');

var port           = require('../../../config/sysconfig').port;

var HtmlLib	       = require('../../../lib/classHtml');
var dec            = require('../../../lib/declaration');
var CartonLabelLib    = require('../../../lib/classPatientCartonLabel');
var BottleLabelLib    = require('../../../lib/classPatientBottleLabel');
var ShippingStationLib    = require('../../../lib/classShippingStation');

var router         = express.Router();
var html           = new HtmlLib();
var carton   = new CartonLabelLib();
var bottle = new BottleLabelLib();
var shipping = new ShippingStationLib();

//Bottle Label
function ShowPatientBottleLabel(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('patientBottleLabel');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('Labeling') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowPatientBottleLabel */

router.get('/API/bottleLabel', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowPatientBottleLabel(null, loggedInUser, req, res);
});

router.post('/API/DtGetBottleLabel', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	bottle.DtGetData(req, loggedInUser, function(Resp){
		
		res.send(Resp);
	});

});
//Carton Label

function ShowPatientCartonLabel(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('patientCartonLabel');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('Labeling') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowPatientCartonLabel */

router.get('/API/cartonLabel', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowPatientCartonLabel(null, loggedInUser, req, res);
});

router.post('/API/DtGetCartonLabel', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	carton.DtGetData(req, loggedInUser, function(Resp){
		res.send(Resp);
	});

});

//Shipping Label
function ShowShippingCartonLabel(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('shippingCartonLabel');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('Labeling') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowShippingCartonLabel */

router.get('/API/shippingcartonLabel', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowShippingCartonLabel(null, loggedInUser, req, res);
});

router.post('/API/DtGetShippingCartonLabel', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	shipping.DtGetData(req, loggedInUser, function(Resp){
		res.send(Resp);
	});

});
module.exports = router;
