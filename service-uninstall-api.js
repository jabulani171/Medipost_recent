var Service = require('node-windows').Service;

if(process.argv.length == 4){
	var ServiceName   = process.argv[2];
	var ScriptPath    = process.argv[3];

	// Create a new service object
	var svc = new Service({
	  name: ServiceName, //'WHE API',
	  script: ScriptPath //'C:\\apex_whe_api 2017-09-27\\server.js'
	});

	// Listen for the "uninstall" event so we know when it's done.
	svc.on('uninstall',function(){
	  console.log('Uninstall complete.');
	  console.log('The service exists: ',svc.exists);
	});

	// Uninstall the service.
	svc.uninstall();
} else {
	console.log('NOT UNINSTALLING!! Please provide all inputs [Service Name | Script exe path]');
}