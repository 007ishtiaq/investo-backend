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
      enum: [
        "twitter_follow",
        "twitter_share",
        "youtube_subscribe",
        "youtube_watch",
        "telegram_join",
        "screenshot",
        "login",
        "profile",
        "custom",
      ],
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
    reward: {
      type: Number,
      required: true,
      min: 0.001,
    },
    externalUrl: String,
    steps: [String],
    note: String,
    active: {
      type: Boolean,
      default: true,
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
