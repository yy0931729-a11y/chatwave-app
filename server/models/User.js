const mongoose = require('mongoose');
const Schema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  avatar: String
});
module.exports = mongoose.model('User', Schema);
