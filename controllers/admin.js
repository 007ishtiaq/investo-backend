// server/controllers/admin.js
const UserTask = require("../models/userTask");
const Task = require("../models/tasks");
const { creditToWallet } = require("./wallet");
const User = require("../models/user");
const { creditRewardToWallet } = require("./task");

// Task verification and reward crediting
// Task verification and reward crediting
exports.approveTask = async (req, res) => {
  try {
    // Change this line to match the route parameter name
    const userTaskId = req.params.userTaskId; // Changed from req.params.id
    console.log("Processing approval for userTaskId:", userTaskId);

    // Find the user task submission
    const userTask = await UserTask.findById(userTaskId);
    if (!userTask) {
      return res
        .status(404)
        .json({ success: false, message: "Task submission not found" });
    }

    // Find the task to get reward amount
    const task = await Task.findById(userTask.taskId);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // Update user task status
    userTask.status = "approved";
    userTask.verified = true;
    userTask.completed = true;
    userTask.completedAt = new Date();

    // Find the user email for wallet crediting - this is important
    const user = await User.findById(userTask.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Credit reward to wallet using email
    try {
      await creditRewardToWallet(
        user.email, // Use user's email instead of userId
        task.reward,
        "task_reward", // Make sure this matches your Transaction schema enum
        `Admin approved reward for "${task.title}"`
      );
      console.log(`Reward of ${task.reward} credited to ${user.email}`);
    } catch (walletError) {
      console.error("Error crediting wallet:", walletError);
      return res.status(500).json({
        success: false,
        message: "Failed to credit reward: " + walletError.message,
      });
    }

    // Save the updated user task
    await userTask.save();

    res.status(200).json({
      success: true,
      message: `Task approved and ${task.reward.toFixed(
        3
      )} USD credited to user's wallet`,
    });
  } catch (err) {
    console.error("Error approving task:", err);
    res.status(500).json({
      success: false,
      message: "Failed to approve task: " + err.message,
    });
  }
};

// You would use the same creditRewardToWallet helper function here

// Reject task (no reward)
exports.rejectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const userTask = await UserTask.findById(id);

    if (!userTask) {
      return res.status(404).json({ error: "Task submission not found" });
    }

    userTask.status = "rejected";
    userTask.rejectionReason = rejectionReason;
    userTask.rejectedAt = Date.now();
    userTask.rejectedBy = req.user._id;

    await userTask.save();

    res.status(200).json({
      success: true,
      message: "Task rejected",
    });
  } catch (error) {
    console.error("Error rejecting task:", error);
    res.status(500).json({ error: "Failed to reject task" });
  }
};
