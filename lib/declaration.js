var Enum = require('enum');

/* Batch Statuses */
exports.BatchStatus = new Enum({
	'New'        : 0,
	'Printing'   : 1,
	'Printed'    : 2,
	'Started'    : 3,
	'Packed'     : 4,
    'Shipped'    : 5
   });

/* Location Statuses */


/* Patient Script Statuses */
exports.PatientScriptStatus = new Enum({
	'New'        : 0,
	'Printed'    : 1,
	'Packed'     : 2,
	'Packed'     : 3,
	'Packed'     : 4
});