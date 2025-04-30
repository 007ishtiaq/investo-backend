// server/models/investment.js
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;

const investmentSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    plan: {
      type: ObjectId,
      ref: "InvestmentPlan",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    initialAmount: {
      type: Number,
      required: true,
    },
    profit: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "completed", "terminated"],
      default: "active",
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    lastProfitDate: {
      type: Date,
    },
    deposit: {
      type: ObjectId,
      ref: "Deposit",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Investment", investmentSchema);
