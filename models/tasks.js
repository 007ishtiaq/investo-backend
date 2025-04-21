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
    steps: {
      type: [String],
      required: true,
    },
    reward: {
      type: Number,
      required: true,
      default: 0.001,
    },
    type: {
      type: String,
      enum: [
        "twitter_follow",
        "twitter_share",
        "youtube_subscribe",
        "youtube_watch",
        "telegram_join",
        "login",
        "profile",
        "custom",
      ],
      required: true,
    },
    link: {
      type: String,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "easy",
    },
    estimatedTime: {
      type: String,
      default: "5 min",
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", taskSchema);
