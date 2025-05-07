// server/controllers/user.js (additions for level management)
const User = require("../models/user");
const Transaction = require("../models/transaction");
const Wallet = require("../models/wallet");

// Get all users for admin with wallet balances
// Get all users for admin with wallet balances and team info
exports.getUsers = async (req, res) => {
  try {
    // Fetch all users, excluding sensitive information
    const users = await User.find({})
      .select("-__v -password") // Exclude sensitive fields
      .sort({ createdAt: -1 }); // Sort by newest first

    // Create a map of user IDs to user objects for easier referrer lookup
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = user;
    });

    // Get all wallets in a single query for efficiency
    const wallets = await Wallet.find({
      email: { $in: users.map((user) => user.email) },
    });

    // Create a lookup map for quick access to wallets
    const walletMap = {};
    wallets.forEach((wallet) => {
      walletMap[wallet.email] = {
        balance: wallet.balance,
        currency: wallet.currency,
        isActive: wallet.isActive,
      };
    });

    // Process all users to add wallet data and team info
    const usersWithData = users.map((user) => {
      const userObject = user.toObject();

      // Add wallet data
      userObject.wallet = walletMap[user.email] || {
        balance: 0,
        currency: "USD",
        isActive: true,
      };

      // Add team info
      userObject.team = {
        count: 0,
        members: [],
      };

      return userObject;
    });

    // Count team members for each user
    users.forEach((user) => {
      if (user.referrer) {
        const referrerId = user.referrer.toString();
        // Find the referrer in our processed users array
        const referrerIndex = usersWithData.findIndex(
          (u) => u._id.toString() === referrerId
        );

        if (referrerIndex !== -1) {
          // Increment the team count
          usersWithData[referrerIndex].team.count += 1;

          // Add to the team members array (limit to first 5 for performance)
          if (usersWithData[referrerIndex].team.members.length < 5) {
            usersWithData[referrerIndex].team.members.push({
              _id: user._id,
              name: user.name || "Anonymous",
              email: user.email,
              level: user.level || 1,
            });
          }
        }
      }
    });

    res.json(usersWithData);
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

// Update notification preferences
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const { deposits, earnings, promotions, security } = req.body;

    // Validate input
    if (
      deposits === undefined ||
      earnings === undefined ||
      promotions === undefined ||
      security === undefined
    ) {
      return res
        .status(400)
        .json({ error: "All notification preferences are required" });
    }

    // Find and update user
    const updated = await User.findOneAndUpdate(
      { uid: req.user.uid },
      {
        notifications: {
          deposits,
          earnings,
          promotions,
          security,
        },
      },
      { new: true }
    ).exec();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return success response
    res.json({
      success: true,
      notifications: updated.notifications,
    });
  } catch (error) {
    console.error("UPDATE NOTIFICATION PREFERENCES ERROR", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Get total deposits for a user
exports.getTotalDeposits = async (req, res) => {
  try {
    const email = req.user.email;
    // Aggregate total successful deposits
    const result = await Transaction.aggregate([
      {
        $match: {
          email,
          source: "deposit",
          status: "completed",
          type: "credit",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);
    // Return 0 if no deposits found
    const total = result.length > 0 ? result[0].total : 0;
    res.json({
      success: true,
      total,
    });
  } catch (error) {
    console.error("GET_TOTAL_DEPOSITS_ERROR", error);
    res.status(500).json({
      error: "Error fetching total deposits",
    });
  }
};
// Get total withdrawals for a user
exports.getTotalWithdrawals = async (req, res) => {
  try {
    const email = req.user.email;
    // Aggregate total successful withdrawals
    const result = await Transaction.aggregate([
      {
        $match: {
          email,
          source: "withdrawal",
          status: "completed",
          type: "debit",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);
    // Return 0 if no withdrawals found
    const total = result.length > 0 ? result[0].total : 0;
    res.json({
      success: true,
      total,
    });
  } catch (error) {
    console.error("GET_TOTAL_WITHDRAWALS_ERROR", error);
    res.status(500).json({
      error: "Error fetching total withdrawals",
    });
  }
};
// Get team earnings for a user
exports.getTeamEarnings = async (req, res) => {
  try {
    const email = req.user.email;
    // Aggregate total referral earnings
    const result = await Transaction.aggregate([
      {
        $match: {
          email,
          source: "referral",
          status: "completed",
          type: "credit",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);
    // Return 0 if no team earnings found
    const total = result.length > 0 ? result[0].total : 0;
    res.json({
      success: true,
      total,
    });
  } catch (error) {
    console.error("GET_TEAM_EARNINGS_ERROR", error);
    res.status(500).json({
      error: "Error fetching team earnings",
    });
  }
};

// Get total earnings for a user (from all sources)
exports.getTotalEarnings = async (req, res) => {
  try {
    const email = req.user.email;
    // Aggregate total earnings from all sources
    const result = await Transaction.aggregate([
      {
        $match: {
          email,
          type: "credit",
          status: "completed",
          $or: [
            { source: "referral" },
            { source: "task_reward" },
            { source: "bonus" },
          ],
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);
    // Get weekly earnings breakdown (for the progress)
    const currentDate = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(currentDate.getDate() - 7);

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(currentDate.getDate() - 14);
    // This week's earnings
    const thisWeekResult = await Transaction.aggregate([
      {
        $match: {
          email,
          type: "credit",
          status: "completed",
          createdAt: { $gte: oneWeekAgo },
          $or: [
            { source: "referral" },
            { source: "task_reward" },
            { source: "bonus" },
          ],
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);
    // Last week's earnings
    const lastWeekResult = await Transaction.aggregate([
      {
        $match: {
          email,
          type: "credit",
          status: "completed",
          createdAt: { $gte: twoWeeksAgo, $lt: oneWeekAgo },
          $or: [
            { source: "referral" },
            { source: "task_reward" },
            { source: "bonus" },
          ],
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);
    // Get breakdown by earnings type
    const breakdownResult = await Transaction.aggregate([
      {
        $match: {
          email,
          type: "credit",
          status: "completed",
          $or: [
            { source: "referral" },
            { source: "task_reward" },
            { source: "bonus" },
          ],
        },
      },
      {
        $group: {
          _id: "$source",
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);
    // Format the breakdown for easier frontend use
    const breakdown = {};
    breakdownResult.forEach((item) => {
      breakdown[item._id] = item.total;
    });
    // Calculate growth rate
    const thisWeekTotal =
      thisWeekResult.length > 0 ? thisWeekResult[0].total : 0;
    const lastWeekTotal =
      lastWeekResult.length > 0 ? lastWeekResult[0].total : 0;

    let weeklyGrowth = 0;
    if (lastWeekTotal > 0) {
      weeklyGrowth = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
    } else if (thisWeekTotal > 0) {
      weeklyGrowth = 100; // 100% growth if there was nothing last week but earnings this week
    }
    // Return all the data
    res.json({
      success: true,
      total: result.length > 0 ? result[0].total : 0,
      thisWeek: thisWeekTotal,
      lastWeek: lastWeekTotal,
      weeklyGrowth: parseFloat(weeklyGrowth.toFixed(2)),
      breakdown,
    });
  } catch (error) {
    console.error("GET_TOTAL_EARNINGS_ERROR", error);
    res.status(500).json({
      error: "Error fetching total earnings",
    });
  }
};
