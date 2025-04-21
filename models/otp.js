const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  userEmail: String,
  otp: String,
  isVerified: { type: Boolean, default: false },
  createdAt: Date,
  expiredAt: Date,
});

const OtpVerification = mongoose.model("OtpVerification", otpSchema);

module.exports = OtpVerification;
