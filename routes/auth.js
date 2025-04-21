const express = require("express");
const rateLimit = require("express-rate-limit");

const router = express.Router();

// Define the rate limiter at initialization
const otpRateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000, // 30 minutes window
  max: 5, // limit each IP to 5 request per windowMs
  message: {
    error: "OTP request limit exceeded. Please retry after some time",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// middlewares
const { authCheck, adminCheck, expiryCheck } = require("../middlewares/auth");

// import
const {
  createOrUpdateUser,
  // createOrUpdatePhoneUser,
  currentUser,
  sendOTP,
  verifyOTP,
  getOTPRecord,
} = require("../controllers/auth");

router.post(
  "/create-or-update-user",
  expiryCheck,
  authCheck,
  createOrUpdateUser
);
// router.post("/create-or-update-phone-user", expiryCheck, authCheck, createOrUpdatePhoneUser);
router.post("/current-user", expiryCheck, authCheck, currentUser);
router.post("/current-admin", expiryCheck, authCheck, adminCheck, currentUser);
router.post("/send-otp", expiryCheck, otpRateLimiter, sendOTP);
router.post("/verify-otp", expiryCheck, verifyOTP);
router.post("/otpinfo", expiryCheck, getOTPRecord);

module.exports = router;
