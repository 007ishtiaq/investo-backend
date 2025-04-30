// server/models/investmentPlan.js
const mongoose = require("mongoose");

const investmentPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    minAmount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    maxAmount: {
      type: Number,
      required: true,
    },
    durationInDays: {
      type: Number,
      required: true,
      min: 1,
    },
    returnRate: {
      type: Number,
      required: true,
      min: 0,
    },
    dailyIncome: {
      type: Number,
      default: 0,
    },
    isFixedDeposit: {
      type: Boolean,
      default: false,
    },
    features: {
      type: [String],
      default: [],
    },
    minLevel: {
      type: Number,
      default: 1,
      min: 1,
      max: 4,
    },
    active: {
      type: Boolean,
      default: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InvestmentPlan", investmentPlanSchema);
