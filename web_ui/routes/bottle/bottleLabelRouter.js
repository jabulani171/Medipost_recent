var express        = require('express');
var mustache       = require('mustache');
var formidable     = require("formidable");
var async          = require('async');
var moment 		   = require('moment');

var port           = require('../../../config/sysconfig').port;

var HtmlLib	       = require('../../../lib/classHtml');
var dec            = require('../../../lib/declaration');
var BottleCartonPairLib    = require('../../../lib/classPatientBottleLabel');

var router         = express.Router();
var html           = new HtmlLib();
var bottlecarton   = new BottleCartonPairLib();

function ShowPackingStation(Resp, loggedInUser, req, res){
	let frame = {};
	let page = html.GetPage(null);
	frame.ext = html.GetPage('patientBottleLabel');
	let Data = html.GetEmptyPage(loggedInUser);

	if(req.session.UserPriv.indexOf('Labeling') >= 0){
		Data.Granted = true;
	}

	let htmlpage = mustache.render(page, Data, frame);
	res.send(htmlpage);
} /* ShowPackingStation */

router.get('/API/bottleLabel', html.requireLogin, function (req, res) {
	let loggedInUser = req.session.username;

	ShowPackingStation(null, loggedInUser, req, res);
});

router.post('/API/DtGetPatientStation', html.requireLogin, function (req, res){
	let loggedInUser = req.session.username;

	bottlecarton.DtGetData(req, loggedInUser, function(Resp){
		res.send(Resp);
	});

});
module.exports = router;
