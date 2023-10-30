var mongoose = require('mongoose');
var moment   = require('moment');

var Schema = mongoose.Schema

var userSchema = new Schema({
  UserID         : {type: String, required: true, index: {unique: true}},
  FirstName		 : {type: String, required: true},
  LastName       : {type: String, required: true},
  Password       : {type: String, required: true, bcrypt: true },
  created_at     : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')},
  updated_at     : {type: String, default: moment(new Date()).format('YYYY-MM-DD HH:mm:ss')},
  LastUpdateUser : {type: String, default: null },
  UserGroup      : []
}, { collection: 'SysUsers'})

userSchema.plugin(require('mongoose-bcrypt'));

const User=mongoose.model('SysUsers', userSchema);

module.exports = User;