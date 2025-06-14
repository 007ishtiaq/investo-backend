const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: {
      type: String,
      required: true,
      index: true,
    },
    contact: {
      type: String,
    },
    profileImage: {
      type: String,
      default: "", // URL to Cloudinary image
    },
    role: {
      type: String,
      default: "subscriber",
    },
    profile: {},
    // New fields for affiliate system
    level: {
      type: Number,
      default: 0,
    },
    affiliateCode: {
      type: String,
      unique: true,
      sparse: true, // Allows null values
    },
    referrer: {
      type: ObjectId,
      ref: "User",
    },
    // Track the amount of rewards earned from affiliates
    affiliateEarnings: {
      type: Number,
      default: 0,
    },
    // Notification preferences
    notifications: {
      deposits: { type: Boolean, default: true },
      earnings: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      security: { type: Boolean, default: true },
    },
    uid: {
      type: String,
      required: true, // This ensures it can't be null
      unique: true,
    },
  },
  { timestamps: true }
);

// Create a unique affiliate code when a user is saved
userSchema.pre("save", async function (next) {
  if (!this.affiliateCode) {
    // Generate unique code based on email and a random string
    const randomString = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();
    this.affiliateCode = `${this.email
      .substring(0, 3)
      .toUpperCase()}${randomString}`;
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
