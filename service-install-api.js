var Service = require('node-windows').Service;
var EventLogger = require('node-windows').EventLogger;

if(process.argv.length == 5){
	var ServiceName   = process.argv[2];
	var ServiceDesc   = process.argv[3];
	var ScriptPath    = process.argv[4];

	var log = new EventLogger(ServiceName); /*'WHE API'*/

	log.info('Basic information.');
	log.warn('Watch out!');
	log.error('Something went wrong.');

	// Create a new service object
	var svc = new Service({
	  name: ServiceName, //'WHE API',
	  description: ServiceDesc, //'Warehouse Expert Apex API',
	  script: ScriptPath, //'C:\\apex_whe_api 2017-09-27\\server.js',
	  nodeOptions: [
		'--harmony',
		'--max_old_space_size=4096',
	  ],
	  wait: 2,
	  grow: .5
	});

	// Listen for the "install" event, which indicates the
	// process is available as a service.
	svc.on('install',function(){
	  svc.start();
	});

	svc.install();
} else {
	console.log('NOT INSTALLING!! Please provide all inputs [Service Name | Service Description | Script exe path]');
}