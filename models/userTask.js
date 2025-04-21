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
    completedAt: {
      type: Date,
    },
    completed: {
      type: Boolean,
      default: false,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    verificationData: {
      type: Object,
    },
    reward: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Ensure each user can only have one record per task
userTaskSchema.index({ userId: 1, taskId: 1 }, { unique: true });

module.exports = mongoose.model("UserTask", userTaskSchema);
