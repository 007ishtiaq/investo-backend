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
    const user = await User.findOne({ email: req.user.email }).select("level");

    res.json({
      level: user.level || 1,
    });
  } catch (error) {
    console.error("Get user level error:", error);
    res.status(500).json({ error: "Failed to get user level" });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Don't send sensitive information
    const { name, email, contact, role, affiliateCode, level, _id } = user;

    res.json({
      _id,
      name,
      email,
      contact,
      role,
      affiliateCode,
      level,
    });
  } catch (error) {
    console.error("GET CURRENT USER ERROR", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, contact } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    // Find and update user
    const updated = await User.findOneAndUpdate(
      { email: req.user.email },
      { name, contact },
      { new: true }
    ).exec();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    // Don't send sensitive information
    const { email, role, affiliateCode, level, _id } = updated;

    res.json({
      _id,
      name: updated.name,
      email,
      contact: updated.contact,
      role,
      affiliateCode,
      level,
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR", error);
    res.status(500).json({ error: "Server error" });
  }
};
