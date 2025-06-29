// server/models/task.js
const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["youtube_watch", "screenshot", "custom"],
      required: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },
    estimatedTime: {
      type: String,
      default: "5 mins",
    },
    rewardPercentage: {
      type: Number,
      required: true,
      min: 0.1,
      max: 100,
      default: 0.5, // Default 0.5%
    },
    externalUrl: String,
    steps: [String],
    note: String,
    active: {
      type: Boolean,
      default: true,
    },
    minLevel: {
      type: Number,
      default: 1,
    },
    // New fields for date control
    displayDate: {
      type: Date,
      default: null, // When null, task is shown every day
    },
    // Screenshot fields
    screenshotRequired: {
      type: Boolean,
      default: false,
    },
    screenshotInstructions: {
      type: String,
      default: "",
    },
    // YouTube watch fields
    autoVerify: {
      type: Boolean,
      default: false,
    },
    videoDuration: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
