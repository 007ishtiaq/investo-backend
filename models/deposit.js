// server/models/deposit.js
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;

const depositSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: "USD",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    transactionId: {
      type: String,
    },
    screenshotUrl: {
      type: String,
      required: true,
    },
    adminNotes: {
      type: String,
    },
    approvedBy: {
      type: ObjectId,
      ref: "User",
    },
    assignedPlan: {
      type: ObjectId,
      ref: "InvestmentPlan",
    },
    approvedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Deposit", depositSchema);
