// node .\seedPlans.js

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
    minAmount: 2,
    maxAmount: 9,
    durationInDays: 1,
    returnRate: 0.5,
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
    minAmount: 10,
    maxAmount: 199,
    durationInDays: 1,
    returnRate: 2,
    dailyIncome: 2,
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
    minAmount: 200,
    maxAmount: 499,
    durationInDays: 1,
    returnRate: 3, // 1.2% daily * 90 days
    dailyIncome: 3,
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
    minAmount: 500,
    maxAmount: 1000000,
    durationInDays: 1,
    returnRate: 4, // 1.5% daily * 180 days
    dailyIncome: 4,
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
