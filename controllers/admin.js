// server/controllers/admin.js
const UserTask = require("../models/userTask");
const Task = require("../models/tasks");
const { creditToWallet } = require("./wallet");
const User = require("../models/user");

// Task verification and reward crediting
exports.approveTask = async (req, res) => {
  try {
    const { userTaskId } = req.params;

    // Find the user task submission with user population
    const userTask = await UserTask.findById(userTaskId)
      .populate({
        path: "taskId",
        select: "title reward type",
      })
      .populate({
        path: "userId",
        select: "email", // We just need email
      });

    if (!userTask) {
      return res.status(404).json({ error: "Task submission not found" });
    }

    // Mark as approved and completed
    userTask.status = "approved";
    userTask.verified = true;
    userTask.completed = true;
    userTask.verifiedAt = Date.now();
    userTask.verifiedBy = req.user.email;
    await userTask.save();

    // Credit reward to user's wallet
    const task = userTask.taskId;
    const reward = task.reward;

    // Get user email
    let userEmail;

    // If userId is populated as an object with email
    if (
      userTask.userId &&
      typeof userTask.userId === "object" &&
      userTask.userId.email
    ) {
      userEmail = userTask.userId.email;
    }
    // If userId is not populated, look up the user
    else {
      const user = await User.findById(userTask.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found for task" });
      }
      userEmail = user.email;
    }

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        error: "Could not determine user email",
        message:
          "Task approved but couldn't credit reward due to missing user email",
      });
    }

    console.log("Using email for wallet credit:", userEmail);

    try {
      const result = await creditToWallet(
        userEmail,
        reward,
        "task_reward",
        `Reward for completing task: ${task.title}`,
        { taskId: task._id }
      );

      console.log(
        `Successfully credited ${reward} to wallet for user ${userEmail}`
      );

      res.status(200).json({
        success: true,
        message: "Task approved and reward credited to user wallet",
        transaction: result.transaction,
      });
    } catch (walletError) {
      console.error("Error crediting wallet:", walletError);

      res.status(200).json({
        success: true,
        message: "Task approved but failed to credit reward",
        walletError: walletError.message,
      });
    }
  } catch (error) {
    console.error("Error approving task:", error);
    res.status(500).json({ error: "Failed to approve task" });
  }
};

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
