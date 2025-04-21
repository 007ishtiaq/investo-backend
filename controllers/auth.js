const User = require("../models/user");
const { transporter } = require("../middlewares/utils");
const OtpVerification = require("../models/otp");
const bcrypt = require("bcrypt");
const { otpEmailtemplate } = require("../middlewares/utils");

exports.createOrUpdateUser = async (req, res) => {
  const { picture, email } = req.user;

  const user = await User.findOneAndUpdate(
    { email },
    { picture },
    { new: true }
  );
  if (user) {
    // Remove all previously saved OTPs for this email
    await OtpVerification.deleteMany({ userEmail: email });
    // console.log("USER UPDATED", user);
    res.json(user);
  } else {
    const newUser = await new User({
      email,
      picture,
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
      // Remove all previously saved OTPs for this email
      await OtpVerification.deleteMany({ userEmail: email });

      // Hash the OTP before saving it to the database
      const hashedOtp = await bcrypt.hash(otp.toString(), saltRounds);

      // Save the OTP with email and timestamps in your database
      const otpVerification = new OtpVerification({
        userEmail: email,
        otp: hashedOtp,
        createdAt: new Date(),
        expiredAt: new Date(Date.now() + 10 * 60 * 1000), // OTP expires in 10 minutes
      });

      await otpVerification.save();

      // Email content
      const mailOptions = {
        from: "Your App <ishtiaqahmad427427@gmail.com>",
        to: email,
        subject: "Crystoos [OTP Code]",
        // text: `Your OTP code is ${otp}. It will expire in 10 minutes.`,
        html: otpEmailtemplate((otpCode = otp)),
      };

      // Send email using Mailjet
      await transporter.sendMail(mailOptions);

      res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ error: "Failed to send OTP email" });
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
