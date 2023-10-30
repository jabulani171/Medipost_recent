var express        = require('express');
var router         = express.Router();
var mustache       	= require('mustache');
var HtmlLib	       = require('../../../lib/classHtml');
var html           = new HtmlLib();
var UserLib        = require('../../../lib/classUser');
var user           = new UserLib();








//hTM

router.get('/UTIL/createUser/',function(req, res){

	let frame = {};
	let page = html.GetPage('createUser');
	//frame.ext = html.GetPage('createUser');
	let Data = html.GetEmptyPage("");

	
	let htmlpage = mustache.render(page, Data, "");
	res.send(htmlpage);

	//res.send("Hello");

});

router.post('/createUser', function (req, res) {
 
   //Check Requered fields

		   UtilsCreateUser(req, res);
});
function UtilsCreateUser(req, res){
	
	user.FormNewUserObj(req, function(Resp){
		//console.log("nothing");
		if(Resp.UserData){
			//log.WriteToFile(ProcName, 'DATA ' + JSON.stringify(Resp));
			
			user.New(Resp.UserData, function(Resp){
				
				res.send("the information was successfuly loaded");
				
			});
		} else {
			res.send('Incorrect Values Supplied');
		}
	});
} /* UtilsCreateUser */


module.exports = router;
