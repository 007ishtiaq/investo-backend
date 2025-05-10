// models/AffiliateReward.js
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;

const affiliateRewardSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    referralUser: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    referralLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    sourceLevel: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    processedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("AffiliateReward", affiliateRewardSchema);
