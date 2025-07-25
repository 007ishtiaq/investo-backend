// server/models/userTask.js
const mongoose = require("mongoose");

const userTaskSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    taskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    completedAt: Date,
    reward: {
      type: Number,
      required: false, // Changed from true to false
      default: 0, // Added default value
    },
    verificationData: {
      type: Object,
      default: {},
    },
    status: {
      type: String,
      enum: [
        "started",
        "pending_verification",
        "approved",
        "rejected",
        "completed",
      ],
      default: "started",
    },
    // Add field to store screenshot URL
    screenshot: {
      type: String,
    },
    // Add field to store rejection reason
    rejectionReason: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserTask", userTaskSchema);
