// server/controllers/task.js
const Task = require("../models/tasks");
const UserTask = require("../models/userTask");
const User = require("../models/user");
const Transaction = require("../models/transaction");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const Wallet = require("../models/wallet"); // Import Wallet model

// Create a new task (admin only)
exports.createTask = async (req, res) => {
  try {
    const task = new Task(req.body);
    await task.save();
    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res
      .status(400)
      .json({ message: "Failed to create task", error: error.message });
  }
};

// Get all active tasks
exports.getAllTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ active: true }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error("Error getting tasks:", error);
    res
      .status(500)
      .json({ message: "Failed to get tasks", error: error.message });
  }
};

// Get a specific task
exports.getTask = async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    res.json(task);
  } catch (error) {
    console.error("Error getting task:", error);
    res
      .status(500)
      .json({ message: "Failed to get task", error: error.message });
  }
};

// Update a task (admin only)
exports.updateTask = async (req, res) => {
  // console.log("req.body", req.body);

  try {
    const task = await Task.findByIdAndUpdate(req.params.taskId, req.body, {
      new: true,
      runValidators: true,
    });

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    res.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    res
      .status(400)
      .json({ message: "Failed to update task", error: error.message });
  }
};

// Delete a task (admin only)
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }
    // Also delete any user task records associated with this task
    await UserTask.deleteMany({ taskId: req.params.id });
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task:", error);
    res
      .status(500)
      .json({ message: "Failed to delete task", error: error.message });
  }
};

// Start a task
exports.startTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.user; // Get email from Firebase user

    // Find the user in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if task exists
    const task = await Task.findById(id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // Check if user has already started this task
    let userTask = await UserTask.findOne({ userId: user._id, taskId: id });

    if (userTask) {
      return res.json({ message: "Task already started", userTask });
    }

    // Create a new user task record
    userTask = new UserTask({
      userId: user._id,
      taskId: id,
      startedAt: new Date(),
      reward: task.reward,
    });

    await userTask.save();
    res.status(201).json({ message: "Task started successfully", userTask });
  } catch (error) {
    console.error("Error starting task:", error);
    res
      .status(500)
      .json({ message: "Failed to start task", error: error.message });
  }
};

// Get user's tasks
exports.getUserTasks = async (req, res) => {
  try {
    const { email } = req.user; // Get email from Firebase user

    // Find the user in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userTasks = await UserTask.find({ userId: user._id });
    res.json(userTasks);
  } catch (error) {
    console.error("Error getting user tasks:", error);
    res
      .status(500)
      .json({ message: "Failed to get user tasks", error: error.message });
  }
};

// Get user's task earnings and wallet balance
exports.getTaskEarnings = async (req, res) => {
  try {
    const { email } = req.user;

    if (!email) {
      return res
        .status(400)
        .json({ message: "Email not available in authentication" });
    }

    // Find the user in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Finding earnings for user:", user._id);
    console.log("Email for wallet lookup:", email);

    // Calculate task earnings using MongoDB ObjectId
    const userId = user._id;
    const result = await UserTask.aggregate([
      {
        $match: {
          userId: userId,
          verified: true,
          completed: true,
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$reward" },
        },
      },
    ]);

    const totalEarnings = result.length > 0 ? result[0].totalEarnings : 0;
    console.log("Earnings calculation result:", result);

    // Get wallet using email
    let wallet = await Wallet.findOne({ email });
    const walletBalance = wallet ? wallet.balance : 0;

    // If no wallet exists yet but user has earnings, create a wallet
    if (!wallet && totalEarnings > 0) {
      try {
        const { createUserWallet } = require("./wallet");
        wallet = await createUserWallet(email);
        console.log(
          `Created new wallet for user ${email} during earnings check`
        );
      } catch (walletError) {
        console.error(
          "Error creating wallet during earnings check:",
          walletError
        );
      }
    }

    // Return both earnings and wallet balance
    res.json({
      totalEarnings,
      walletBalance,
      walletExists: !!wallet,
    });
  } catch (error) {
    console.error("Error getting task earnings:", error);
    res
      .status(500)
      .json({ message: "Failed to get task earnings", error: error.message });
  }
};

// Get all tasks (including inactive) for admin
exports.getAllTasksAdmin = async (req, res) => {
  try {
    // Get all tasks, sorted by latest first
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error("Error getting admin tasks:", error);
    res
      .status(500)
      .json({ message: "Failed to get tasks", error: error.message });
  }
};

// Get task completion analytics for admin
exports.getTaskCompletionStats = async (req, res) => {
  try {
    // Get count of completed tasks grouped by task
    const completions = await UserTask.aggregate([
      { $match: { completed: true } },
      {
        $group: {
          _id: "$taskId",
          count: { $sum: 1 },
          totalRewards: { $sum: "$reward" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get task details
    const taskIds = completions.map((c) => c._id);
    const tasks = await Task.find({ _id: { $in: taskIds } });

    // Combine data
    const result = completions.map((comp) => {
      const task = tasks.find((t) => t._id.toString() === comp._id.toString());
      return {
        taskId: comp._id,
        title: task ? task.title : "Unknown Task",
        count: comp.count,
        totalRewards: comp.totalRewards,
      };
    });

    res.json(result);
  } catch (error) {
    console.error("Error getting task completion stats:", error);
    res
      .status(500)
      .json({ message: "Failed to get statistics", error: error.message });
  }
};

// Configure cloudinary (add this to your server setup or configure it in your task controller)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Update your verifyTask controller function
exports.verifyTask = async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const userEmail = req.user.email;
    const verificationData = req.body;

    // console.log("Task verification request with email:", {
    //   taskId,
    //   userEmail,
    //   verificationData,
    // });

    // Find the task
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // First, find the user by email to get the proper userId
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with the provided email",
      });
    }

    // Use the found userId
    const userId = user._id;

    // Try to find the user task with the retrieved userId
    let userTask = await UserTask.findOne({
      userId: userId,
      taskId: taskId,
    });

    // console.log("UserTask lookup result:", {
    //   found: !!userTask,
    //   userTaskData: userTask ? userTask._id : null,
    // });

    // If not found, create a new user task entry matching the schema structure
    if (!userTask) {
      console.log(
        "UserTask not found, creating new entry with userId:",
        userId
      );
      userTask = new UserTask({
        userId: userId, // Use the userId we got from the database
        taskId: taskId,
        startedAt: new Date(),
        completed: false,
        verified: false,
        reward: task.reward,
        status: "started",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Save the new user task
      await userTask.save();
      // console.log("Created new UserTask:", userTask._id);
    }

    if (userTask.completed) {
      return res.status(400).json({
        success: false,
        message: "This task has already been completed",
      });
    }

    // Handle task verification based on task type
    if (task.type === "youtube_watch" && verificationData.autoVerified) {
      try {
        // Verify the user has watched the required duration
        const watchedDuration = parseInt(verificationData.watchedDuration || 0);
        const requiredDuration = parseInt(task.videoDuration || 30);

        if (watchedDuration < requiredDuration) {
          return res.status(400).json({
            success: false,
            message: `You need to watch the video for at least ${requiredDuration} seconds`,
          });
        }

        // Mark task as completed
        userTask.completed = true;
        userTask.verified = true;
        userTask.status = "approved";
        userTask.completedAt = new Date();
        userTask.updatedAt = new Date();

        try {
          // Save the task first to mark it as completed
          await userTask.save();

          // Then credit the reward to user's wallet using email
          await creditRewardToWallet(
            userEmail,
            task.reward,
            "task_reward", // Changed from 'task' to 'task_reward'
            `Reward for completing "${task.title}"`
          );
        } catch (walletError) {
          console.error("Error crediting wallet:", walletError);
          return res.status(500).json({
            success: false,
            message: "Error crediting wallet: " + walletError.message,
          });
        }

        return res.status(200).json({
          success: true,
          message: `Task completed! ${task.reward.toFixed(
            3
          )} USD has been added to your wallet.`,
        });
      } catch (innerError) {
        console.error("Error in YouTube task processing:", innerError);
        return res.status(500).json({
          success: false,
          message: "Error processing YouTube task: " + innerError.message,
        });
      }
    }

    // Rest of the function remains the same...
  } catch (err) {
    console.error("Error verifying task:", err);
    return res.status(500).json({
      success: false,
      message: "An error occurred during verification: " + err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
};

// Update the creditRewardToWallet function with better error logging
exports.creditRewardToWallet = async function (
  userEmail,
  amount,
  source,
  description
) {
  try {
    console.log(`Crediting wallet for ${userEmail} with ${amount}`);

    // Find or create wallet by email
    let wallet = await Wallet.findOne({ email: userEmail });

    if (!wallet) {
      console.log(`Creating new wallet for ${userEmail}`);
      wallet = new Wallet({
        email: userEmail,
        balance: 0,
        currency: "USD",
        isActive: true,
        lastUpdated: new Date(),
      });
    }

    // Update wallet balance
    const previousBalance = Number(wallet.balance || 0);
    wallet.balance = previousBalance + Number(amount);
    wallet.lastUpdated = new Date();

    console.log(
      `Wallet balance update: ${previousBalance} -> ${wallet.balance}`
    );

    // Check valid source values by logging the schema
    console.log("Transaction schema path:", Transaction.schema.path("source"));

    // Create transaction record - use "task_reward" instead of "task" which appears to be invalid
    const transaction = new Transaction({
      email: userEmail,
      walletId: wallet._id,
      amount: Number(amount),
      type: "credit",
      status: "completed",
      source: "task_reward", // Changed from 'task' to 'task_reward'
      description: description || "Task reward",
      previousBalance: previousBalance,
      newBalance: wallet.balance,
      timestamp: new Date(),
    });

    // Save both wallet and transaction
    await wallet.save();
    console.log("Wallet saved successfully:", wallet._id);

    await transaction.save();
    console.log("Transaction created:", transaction._id);

    return true;
  } catch (error) {
    console.error("Error crediting reward to wallet:", error);
    throw new Error(`Failed to credit wallet: ${error.message}`);
  }
};

// server/controllers/admin.js (create or update)

// Get tasks pending verification
exports.getPendingVerificationTasks = async (req, res) => {
  try {
    // Find all user tasks with status "pending_verification"
    const pendingTasks = await UserTask.find({ status: "pending_verification" })
      .populate("userId", "name email") // Get user details
      .populate("taskId"); // Get task details

    res.json(pendingTasks);
  } catch (error) {
    console.error("Error fetching pending verification tasks:", error);
    res.status(500).json({
      error: "Failed to fetch pending verification tasks",
      message: error.message,
    });
  }
};

// Reject a task submission
exports.rejectTask = async (req, res) => {
  try {
    const { userTaskId } = req.params;
    const { rejectionReason } = req.body;

    // Find the user task
    const userTask = await UserTask.findById(userTaskId);
    if (!userTask) {
      return res.status(404).json({ error: "Task submission not found" });
    }

    // Update the task to rejected status
    userTask.status = "rejected";
    userTask.rejectionReason = rejectionReason;
    await userTask.save();

    res.json({
      success: true,
      message: "Task submission rejected",
    });
  } catch (error) {
    console.error("Error rejecting task:", error);
    res.status(500).json({
      error: "Failed to reject task",
      message: error.message,
    });
  }
};
