const User = require("../models/user");
const { transporter } = require("../middlewares/utils");
const OtpVerification = require("../models/otp");
const bcrypt = require("bcrypt");
const { otpEmailtemplate } = require("../middlewares/utils");

exports.createOrUpdateUser = async (req, res) => {
  const { picture, email, uid } = req.user; // Extract uid from Firebase auth token
  const { name } = req.body;

  const user = await User.findOneAndUpdate(
    { email },
    { name, picture, uid }, // Add uid to the update
    { new: true }
  );
  if (user) {
    // Remove all previously saved OTPs for this email
    await OtpVerification.deleteMany({ userEmail: email });
    // console.log("USER UPDATED", user);
    res.json(user);
  } else {
    const newUser = await new User({
      name,
      email,
      picture,
      uid, // Add uid to new user creation
    }).save();
    // Remove all previously saved OTPs for this email
    await OtpVerification.deleteMany({ userEmail: email });
    // console.log("USER CREATED", newUser);
    res.json(newUser);
  }
};

exports.currentUser = async (req, res) => {
  const user = await User.findOne({ email: req.user.email }).exec();
  res.json(user);
};

// OTP sending endpoint
exports.sendOTP = async (req, res) => {
  const { email } = req.body;

  // Check if the email is valid
  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  if (!validateEmail(email)) {
    console.log("Invalid or undeliverable email address");
  }

  // Check if user exists in your database
  const user = await User.findOne({ email });
  if (user) {
    return res
      .status(400)
      .json({ error: "User already exists with provided email" });
  } else {
    // Generate a random 6-digit OTP

    const otp = Math.floor(100000 + Math.random() * 900000);
    const saltRounds = 10;

    try {
      console.log("Step 1: Deleting old OTP entries for email:", email);
      await OtpVerification.deleteMany({ userEmail: email });
      console.log("Step 1 complete: Old OTP entries deleted.");

      // Hash the OTP before saving it to the database
      console.log("Step 2: Hashing OTP...");
      const hashedOtp = await bcrypt.hash(otp.toString(), saltRounds);
      console.log("Step 2 complete: OTP hashed.");

      // Save the OTP with email and timestamps in your database
      console.log("Step 3: Saving OTP in database...");
      const otpVerification = new OtpVerification({
        userEmail: email,
        otp: hashedOtp,
        createdAt: new Date(),
        expiredAt: new Date(Date.now() + 10 * 60 * 1000), // OTP expires in 10 minutes
      });

      await otpVerification.save();
      console.log("Step 3 complete: OTP saved in DB.");

      // Email content
      console.log("Step 4: Preparing email options...");
      const mailOptions = {
        from: '"TrustyVest" <support@trustyvest.com>',
        to: email,
        subject: "TrustyVest [Your OTP Code]",
        html: otpEmailtemplate((otpCode = otp)),
      };
      console.log("Step 4 complete: Email options prepared:", mailOptions);

      // Send email using SMTP
      console.log("Step 5: Sending email via transporter...");
      const emailResult = await transporter.sendMail(mailOptions);
      console.log("Step 5 complete: Email sent successfully.", emailResult);

      res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
      console.log("❌ Error sending OTP:", error);
      res
        .status(500)
        .json({ error: "Failed to send OTP email", details: error.message });
    }
  }
};

exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body.values;

  try {
    // Find the OTP record for the email
    const otpRecord = await OtpVerification.findOne({ userEmail: email });

    if (!otpRecord) {
      return res.status(400).json({
        err: "OTP not found or expired",
      });
    }

    // Check if OTP has expired
    if (new Date() > otpRecord.expiredAt) {
      return res.status(400).json({ err: "OTP has expired" });
    }

    // Compare the OTP provided by the user with the hashed OTP
    const isMatch = await bcrypt.compare(otp.toString(), otpRecord.otp);

    if (!isMatch) {
      return res.status(400).json({ err: "Invalid OTP" });
    }

    res.status(200).json({ message: "OTP verified successfully" });

    // Update the `isVerified` field to `true`
    otpRecord.isVerified = true;
    await otpRecord.save(); // Save the updated record
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
};

exports.getOTPRecord = async (req, res) => {
  const { email } = req.body;

  try {
    // Find the OTP record for the email
    const otpRecord = await OtpVerification.findOne({ userEmail: email });

    if (!otpRecord) {
      return res
        .status(400)
        .json({ message: "No OTP record found for this email." });
    }

    // Send the OTP record to the frontend
    res.status(200).json({
      message: "OTP record retrieved successfully.",
      otpRecord: {
        email: otpRecord.userEmail,
        isVerified: otpRecord.isVerified,
        createdAt: otpRecord.createdAt,
        expiredAt: otpRecord.expiredAt,
      },
    });
  } catch (error) {
    console.error("Error retrieving OTP record:", error);
    res.status(500).json({ error: "Failed to retrieve OTP record." });
  }
};
