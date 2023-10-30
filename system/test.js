var exec = require('child_process').spawn;

var Data = {
	printerName: "BottlePrintApply_01"
};

var child = exec("lpstat", ["-p", Data.printerName]);
var Response = null;

child.stdout.on('data', (data) => {
  //console.log(`child stdout:\n${data}`);

  if(data){
	Response = data.toString();

	if(Response){
		console.log(Response);
		var IsDisabled = false;
		if(Response.indexOf("disabled") >= 0){
			IsDisabled = true;
		}

                if(!IsDisabled && Response.indexOf("Paused") >= 0){
                        IsDisabled = true;
                }

		if(IsDisabled){
			var child1 = exec("cupsenable", [Data.printerName]);

child1.on('close', function(code){
  console.log("In child1 Close");
  console.log(code);
});
		}
	}
  }
});

/*'message', function(err ,code){
  console.log("In Data");
  console.log(err);
  console.log(code);
});*/

child.on('close', function(code){
  console.log("In Close");
  console.log(code);
});
