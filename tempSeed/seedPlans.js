// server/seedPlans.js
const InvestmentPlan = require("../models/investmentPlan");
const mongoose = require("mongoose");
require("dotenv").config();

// Replace with your MongoDB connection string
const MONGODB_URI =
  "mongodb://localhost:27017/MMIN?readPreference=primary&appname=MongoDB%20Compass&ssl=false";

const samplePlans = [
  // Daily Income Plans
  {
    name: "Basic Plan",
    description: "Entry-level plan with daily profit distribution",
    minAmount: 0.1,
    maxAmount: 0.49,
    durationInDays: 30,
    returnRate: 15, // 0.5% daily * 30 days
    dailyIncome: 0.5,
    isFixedDeposit: false,
    features: [
      "Daily profit distribution",
      "No early withdrawal fee",
      "Automatic reinvestment option",
    ],
    minLevel: 1,
    active: true,
    featured: false,
  },
  {
    name: "Standard Plan",
    description: "Mid-level plan with enhanced features and returns",
    minAmount: 0.5,
    maxAmount: 0.99,
    durationInDays: 60,
    returnRate: 48, // 0.8% daily * 60 days
    dailyIncome: 0.8,
    isFixedDeposit: false,
    features: [
      "Daily profit distribution",
      "Priority customer support",
      "Automatic reinvestment option",
      "Weekly performance reports",
    ],
    minLevel: 2,
    active: true,
    featured: true,
  },
  {
    name: "Premium Plan",
    description: "Advanced plan with premium features and higher returns",
    minAmount: 1.0,
    maxAmount: 1.99,
    durationInDays: 90,
    returnRate: 108, // 1.2% daily * 90 days
    dailyIncome: 1.2,
    isFixedDeposit: false,
    features: [
      "Daily profit distribution",
      "Priority customer support",
      "Automatic reinvestment option",
      "Weekly performance reports",
      "Access to exclusive investment pools",
    ],
    minLevel: 3,
    active: true,
    featured: false,
  },
  {
    name: "Elite Plan",
    description: "Top-tier plan with maximum returns and exclusive benefits",
    minAmount: 2.0,
    maxAmount: 10.0,
    durationInDays: 180,
    returnRate: 270, // 1.5% daily * 180 days
    dailyIncome: 1.5,
    isFixedDeposit: false,
    features: [
      "Guaranteed returns",
      "Priority customer support",
      "Automatic reinvestment option",
      "Weekly performance reports",
      "Access to exclusive investment pools",
      "One-on-one investment consultation",
    ],
    minLevel: 4,
    active: true,
    featured: false,
  },
];

const seedPlans = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    await InvestmentPlan.deleteMany({});
    console.log("Cleared existing investment plans");

    const result = await InvestmentPlan.insertMany(samplePlans);
    console.log(`Added ${result.length} sample investment plans`);

    mongoose.connection.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Error seeding investment plans:", error);
    process.exit(1);
  }
};

seedPlans();
