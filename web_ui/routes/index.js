var express        = require('express');
var mustache       = require('mustache');
var router         = express.Router();

var HtmlLib	       = require('../../lib/classHtml');
var html           = new HtmlLib();

router.get('/', function (req, res) {
    html.WEB_CallPageRedirect(res, '/API/');
});

router.get('/API/', html.requireLogin, function (req, res) {
    
    html.WEB_CallPageRedirect(res, '/API/dashboard');
});


module.exports = router