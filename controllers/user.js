// server/controllers/user.js (additions for level management)
const User = require("../models/user");

// Get all users for admin
exports.getUsers = async (req, res) => {
  try {
    // Fetch all users, excluding sensitive information
    const users = await User.find({})
      .select("-__v -password") // Exclude sensitive fields
      .sort({ createdAt: -1 }); // Sort by newest first

    res.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// For admin: Update user level
exports.updateUserLevel = async (req, res) => {
  try {
    const { userId } = req.params;
    const { level } = req.body;

    if (!level || level < 1 || level > 4) {
      return res
        .status(400)
        .json({ error: "Invalid level. Must be between 1 and 4" });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.level = level;
    await user.save();

    res.json({
      success: true,
      message: `User level updated to ${level}`,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        level: user.level,
      },
    });
  } catch (error) {
    console.error("Update user level error:", error);
    res.status(500).json({ error: "Failed to update user level" });
  }
};

// Get user level (for client-side)
exports.getUserLevel = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("level");

    res.json({
      level: user.level || 1,
    });
  } catch (error) {
    console.error("Get user level error:", error);
    res.status(500).json({ error: "Failed to get user level" });
  }
};
