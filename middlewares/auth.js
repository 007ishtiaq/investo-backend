const admin = require("../firebase");
const User = require("../models/user");

// Example usage

exports.expiryCheck = async (req, res, next) => {
  const expiryTime = new Date(process.env.SERVER_EXPIRY).getTime(); // Example expiry time
  const currentTime = new Date().getTime(); // Current time
  const timeDifference = expiryTime - currentTime;

  if (timeDifference > 0) {
    next();
  } else {
    res.status(500).json({
      error: "Server time-out, please contact administrator.",
    });
  }
};

exports.authCheck = async (req, res, next) => {
  try {
    const firebaseUser = await admin
      .auth()
      .verifyIdToken(req.headers.authtoken);
    // console.log("FIREBASE USER IN AUTHCHECK", firebaseUser);
    req.user = firebaseUser;
    next();
  } catch (err) {
    res.status(401).json({
      err: "Invalid or expired token",
    });
  }
};

exports.adminCheck = async (req, res, next) => {
  const { email } = req.user;

  const adminUser = await User.findOne({ email }).exec();

  if (adminUser.role !== "admin") {
    res.status(403).json({
      err: "Admin resource. Access denied.",
    });
  } else {
    next();
  }
};
