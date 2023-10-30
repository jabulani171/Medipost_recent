var express        = require('express');
var https          = require('https');
var bodyParser     = require('body-parser')
var mongoose       = require('mongoose');
var sql            = require('mssql/msnodesqlv8');
var fs             = require('fs');
var moment         = require('moment');
var mustache       = require('mustache');
var async          = require('async');
var formidable     = require('formidable');
var session        = require('client-sessions')
var dbUrl          = require('../config/sysconfig').mongoDB.url;
var port           = require('../config/sysconfig').ui_port;
var config         = require('../config/sysconfig').config;
var logging        = require('../lib/classLogging');
var HtmlLib	       = require('../lib/classHtml');
var app            = express();

var log            = new logging();
var html           = new HtmlLib();

var ProcName       = 'UI';

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.text());

app.use(session({
  cookieName: 'session',
  secret: 'eg[isfd-8yF9-7w2315df{}+Ijsli;;to8',
  duration: 30 * 60 * 1000,
  activeDuration: 5 * 60 * 1000,
  httpOnly: true,
  secure: true,
  ephemeral: true
}));

/********************* DB Connection ***********************************/
var FirstConnect = true;
DbConnect();

function DbConnect(){
	mongoose.connect(dbUrl);
} /* DbConnect */

function DbDisconnect(){
  	mongoose.connection.close(function (){
		log.WriteToFile(ProcName, 'Cleared DB Link');
		setTimeout(function(){
			DbConnect();
		}, 10000);
  	});
} /* DbDisconnect */

sql.connect(config,err =>{
	new sql.Request().query('SELECT * FROM ShipperDetails',(err,result)=>{
		if(err){
			console.log(""+err);
		}
		else{
			console.dir(result);
		};
	});
});
sql.on('error',err => {
	console.log(".:The Bad Place:.");
	console.log("  Fork: "+err)
});

mongoose.connection.on('connected', function () {
	log.WriteToFile(ProcName, 'MongoDB: Connection Established.');
	if(FirstConnect){
		app.listen(port);
		FirstConnect = false;
	}
	log.WriteToFile(ProcName,'Server running at http://127.0.0.1:' + port + '/');
});

mongoose.connection.on('error',function (err) {
	log.WriteToFile(ProcName, 'MongoDB: Connection Error: ');
	return DbDisconnect();
});

mongoose.connection.on('disconnected', function () {
	log.WriteToFile(ProcName, 'Mongoose default connection disconnected');
	return DbDisconnect();
});

/********************* routes *****************************************/

var loginRouter       = require('./routes/login/loginRouter.js');
var userUtilsRouter   = require('./routes/utils/createUserUtil.js');
var indexRouter       = require('./routes/index.js');
var user              = require('./routes/user/userRouter.js');
var auditlogs         = require('./routes/auditlogs/auditlogsRouter.js');
var dashRouter        = require('./routes/dashboard/dashRouter.js');
var paramRouter        = require('./routes/params/paramRouter.js');
var batchRouter        = require('./routes/batch/batchRouter.js');
var bottleLabelRouter        = require('./routes/bottle/bottleLabelRouter.js');
var RejectRouter        = require('./routes/reject/RejectRouter.js');
var packingStationRouter  = require('./routes/packing/PackingStationRouter.js');
var packingRouter  = require('./routes/packing/PackingRouter.js');
var shippingStationRouter       = require('./routes/shipping/shippingStationRouter.js');
var ShippingRouter       = require('./routes/shipping/ShippingRouter.js');
var labelRouter       = require('./routes/carton/labelRouter.js');
var printerListRouter       = require('./routes/printer/printerListRouter.js');
var MaintenanceRouter       = require('./routes/maintenance/MaintenanceRouter.js');



app.use(loginRouter);
app.use(userUtilsRouter);
app.use(indexRouter);
app.use(user);
app.use(auditlogs);
app.use(dashRouter);
app.use(paramRouter);
app.use(batchRouter);
app.use(bottleLabelRouter);
app.use(RejectRouter);
app.use(packingStationRouter);
app.use(packingRouter);

app.use(shippingStationRouter);
app.use(ShippingRouter);
app.use(labelRouter);
app.use(printerListRouter);
app.use(MaintenanceRouter);



app.get('*', function(req, res){
  	html.WEB_CallPageRedirect(res, '/API/');
});

module.exports = app