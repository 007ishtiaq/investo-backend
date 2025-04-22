// server/controllers/task.js
const Task = require("../models/tasks");
const UserTask = require("../models/userTask");
const User = require("../models/user");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;

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
  try {
    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
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

// Get user's task earnings
exports.getTaskEarnings = async (req, res) => {
  try {
    const { email } = req.user; // Get email from Firebase user

    // Find the user in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    console.log("Finding earnings for user:", user._id);

    // Convert string ID to ObjectId if needed (use mongoose.Types.ObjectId)
    const userId = user._id;

    const result = await UserTask.aggregate([
      {
        $match: {
          userId: userId,
          verified: true, // Make sure to check verified flag
          completed: true, // Make sure to check completed flag
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$reward" },
        },
      },
    ]);

    console.log("Earnings calculation result:", result);

    const totalEarnings = result.length > 0 ? result[0].totalEarnings : 0;

    res.json({ totalEarnings });
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

// Add to task.js controller
exports.getTasksAwaitingVerification = async (req, res) => {
  try {
    const pendingTasks = await UserTask.find({
      status: "pending",
      verificationData: { $exists: true },
    })
      .populate("taskId")
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    res.json(pendingTasks);
  } catch (error) {
    console.error("Error getting pending tasks:", error);
    res
      .status(500)
      .json({ message: "Failed to get pending tasks", error: error.message });
  }
};

exports.approveTask = async (req, res) => {
  try {
    const { userTaskId } = req.params;
    const userTask = await UserTask.findById(userTaskId);

    if (!userTask) {
      return res.status(404).json({ message: "Task submission not found" });
    }

    const task = await Task.findById(userTask.taskId);

    // Update user task status
    userTask.status = "completed";
    userTask.verifiedAt = new Date();
    userTask.verifiedBy = req.user._id;
    await userTask.save();

    // Add reward to user's wallet
    const user = await User.findById(userTask.userId);
    user.walletBalance = (
      parseFloat(user.walletBalance) + parseFloat(task.reward)
    ).toFixed(5);
    await user.save();

    res.json({ message: "Task approved and reward issued", userTask });
  } catch (error) {
    console.error("Error approving task:", error);
    res
      .status(500)
      .json({ message: "Failed to approve task", error: error.message });
  }
};

exports.rejectTask = async (req, res) => {
  try {
    const { userTaskId } = req.params;
    const { rejectionReason } = req.body;

    const userTask = await UserTask.findById(userTaskId);

    if (!userTask) {
      return res.status(404).json({ message: "Task submission not found" });
    }

    // Update user task status
    userTask.status = "rejected";
    userTask.rejectionReason = rejectionReason;
    userTask.verifiedAt = new Date();
    userTask.verifiedBy = req.user._id;
    await userTask.save();

    res.json({ message: "Task rejected", userTask });
  } catch (error) {
    console.error("Error rejecting task:", error);
    res
      .status(500)
      .json({ message: "Failed to reject task", error: error.message });
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
  console.log("Verifying task");

  try {
    const { id } = req.params;
    const { email } = req.user; // Get email from Firebase user
    const verificationData = req.body;

    // For debugging
    console.log("Verification data received:", verificationData);

    // Find the user in the database
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if task exists
    const task = await Task.findById(id);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // Check if user has started this task
    let userTask = await UserTask.findOne({ userId: user._id, taskId: id });

    if (!userTask) {
      // If not started, create and start it now
      userTask = new UserTask({
        userId: user._id,
        taskId: id,
        startedAt: new Date(),
        reward: task.reward,
        completed: false,
        verified: false,
      });
    }

    // If already completed, return success
    if (userTask.completed) {
      return res.json({ success: true, message: "Task already completed" });
    }

    // Perform verification based on task type
    let isVerified = false;

    // Special handling for screenshot verification
    if (task.type === "screenshot") {
      // Check if screenshot was provided
      if (verificationData.screenshot) {
        try {
          // Upload to cloudinary
          const uploadResult = await cloudinary.uploader.upload(
            verificationData.screenshot,
            {
              folder: `tasks/${user._id}`,
              resource_type: "auto",
            }
          );

          console.log("Screenshot uploaded:", uploadResult.secure_url);

          // Store the image URL in the userTask
          userTask.screenshot = uploadResult.secure_url;
          verificationData.screenshotUrl = uploadResult.secure_url;
          isVerified = true;
        } catch (error) {
          console.error("Error uploading screenshot:", error);
          return res.status(400).json({
            success: false,
            message: "Failed to upload screenshot. Please try again.",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "Screenshot is required for this task.",
        });
      }
    } else {
      // Handle other task types as before
      switch (task.type) {
        case "twitter_follow":
        case "twitter_share":
          isVerified =
            verificationData.tweetUrl &&
            verificationData.tweetUrl.includes("twitter.com");
          break;

        case "youtube_subscribe":
          isVerified =
            verificationData.channelUrl &&
            verificationData.channelUrl.includes("youtube.com");
          break;

        case "youtube_watch":
          isVerified =
            verificationData.videoUrl &&
            verificationData.videoUrl.includes("youtube.com/watch");
          break;

        case "telegram_join":
          isVerified =
            verificationData.username &&
            verificationData.username.startsWith("@");
          break;

        case "login":
        case "profile":
        case "custom":
          isVerified = true;
          break;

        default:
          isVerified = false;
      }
    }

    if (!isVerified) {
      return res.status(400).json({
        success: false,
        message: "Verification failed. Please check your submission.",
      });
    }

    // Update user task record
    userTask.completed = true;
    userTask.verified = true;
    userTask.completedAt = new Date();
    userTask.verificationData = verificationData;

    await userTask.save();

    // Update user's balance
    if (!user.walletBalance) {
      user.walletBalance = 0;
    }

    user.walletBalance = (
      parseFloat(user.walletBalance) + parseFloat(task.reward)
    ).toFixed(5);
    await user.save();

    res.json({
      success: true,
      message: "Task completed successfully",
      reward: task.reward,
      status: "completed",
    });
  } catch (error) {
    console.error("Error verifying task:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify task",
      error: error.message,
    });
  }
};
