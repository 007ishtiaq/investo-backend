// server/controllers/team.js
const User = require("../models/user");
const Wallet = require("../models/wallet");
const mongoose = require("mongoose");

// Get current user's team members
exports.getTeamMembers = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const founduser = await User.findOne({ email: userEmail });
    // Use the found userId
    const userId = founduser._id;

    // Find all users who have this user as their referrer
    const teamMembers = await User.find({ referrer: userId })
      .select("name email level createdAt")
      .lean();

    // Get statistics
    const totalTeamMembers = teamMembers.length;
    const totalActiveMembers = teamMembers.filter(
      (member) => member.level > 1
    ).length;

    // Get earnings from affiliate program
    const user = await User.findById(userId);
    const affiliateEarnings = user.affiliateEarnings || 0;

    res.status(200).json({
      success: true,
      teamMembers,
      stats: {
        totalMembers: totalTeamMembers,
        activeMembers: totalActiveMembers,
        affiliateEarnings,
      },
    });
  } catch (err) {
    console.error("Error fetching team members:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team members",
    });
  }
};

// Generate or get affiliate link
exports.getAffiliateCode = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const user = await User.findOne({ email: userEmail });

    if (!user.affiliateCode) {
      // Generate a new code if one doesn't exist
      const randomString = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
      user.affiliateCode = `${user.email
        .substring(0, 3)
        .toUpperCase()}${randomString}`;
      await user.save();
    }

    res.status(200).json({
      success: true,
      affiliateCode: user.affiliateCode,
    });
  } catch (err) {
    console.error("Error getting affiliate code:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get affiliate code",
    });
  }
};

// Register with affiliate code
exports.registerWithAffiliateCode = async (req, res) => {
  try {
    const { affiliateCode, userId } = req.body;

    if (!affiliateCode || !userId) {
      return res.status(400).json({
        success: false,
        message: "Affiliate code and user ID are required",
      });
    }

    // Find referrer by affiliate code
    const referrer = await User.findOne({ affiliateCode });
    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: "Invalid affiliate code",
      });
    }

    // Update the new user to reference the referrer
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Only set referrer if not already set
    if (!user.referrer) {
      user.referrer = referrer._id;
      await user.save();

      // You could also credit a bonus to the referrer here
      // For example:
      // await creditReferralBonus(referrer.email, 5, 'referral_bonus', `Referral bonus for ${user.email} joining`);
    }

    res.status(200).json({
      success: true,
      message: "Successfully registered with affiliate code",
    });
  } catch (err) {
    console.error("Error processing affiliate code:", err);
    res.status(500).json({
      success: false,
      message: "Failed to process affiliate code",
    });
  }
};

// Utility function to update user level based on wallet balance and team size
exports.updateUserLevel = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Get user's wallet balance
    const wallet = await Wallet.findOne({ email: user.email });
    const balance = wallet ? wallet.balance : 0;

    // Count team members
    const teamCount = await User.countDocuments({ referrer: userId });

    // Calculate new level based on balance and team size
    // This is just an example - adjust the formula to your needs
    let newLevel = 1;

    if (balance >= 1000 || teamCount >= 10) {
      newLevel = 5;
    } else if (balance >= 500 || teamCount >= 5) {
      newLevel = 4;
    } else if (balance >= 250 || teamCount >= 3) {
      newLevel = 3;
    } else if (balance >= 100 || teamCount >= 1) {
      newLevel = 2;
    }

    // Update level if it has increased
    if (newLevel > user.level) {
      user.level = newLevel;
      await user.save();
    }

    return newLevel;
  } catch (error) {
    console.error("Error updating user level:", error);
  }
};

// Credit a referral bonus to a user
exports.creditReferralBonus = async (req, res) => {
  try {
    const { referrerEmail, amount } = req.body;

    if (!referrerEmail || !amount) {
      return res.status(400).json({
        success: false,
        message: "Referrer email and amount are required",
      });
    }

    // Import the creditRewardToWallet function
    const { creditRewardToWallet } = require("./task");

    // Credit the bonus
    await creditRewardToWallet(
      referrerEmail,
      amount,
      "referral_bonus",
      "Affiliate program bonus"
    );

    // Update the user's affiliate earnings record
    const user = await User.findOne({ email: referrerEmail });
    if (user) {
      user.affiliateEarnings = (user.affiliateEarnings || 0) + Number(amount);
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: `Successfully credited ${amount} to ${referrerEmail}`,
    });
  } catch (err) {
    console.error("Error crediting referral bonus:", err);
    res.status(500).json({
      success: false,
      message: "Failed to credit referral bonus",
    });
  }
};

exports.getTeamEarnings = async (req, res) => {
  try {
    // Get models when the function runs, not when the file loads
    const User = mongoose.model("User");
    const Transaction = mongoose.model("Transaction");
    const AffiliateReward = mongoose.model("AffiliateReward");

    // Find the current user
    const user = await User.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get team members (users who have this user as their referrer)
    const teamMembers = await User.find({ referrer: user._id });

    // Calculate date ranges
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get affiliate rewards
    const allRewards = await AffiliateReward.find({
      user: user._id,
    }).populate("referralUser", "name email level");

    // Find transactions from referrals
    const allTransactions = await Transaction.find({
      email: user.email,
      source: "referral",
      status: "completed",
    });

    // Find recent transactions for specific time periods
    const dailyTransactions = await Transaction.find({
      email: user.email,
      source: "referral",
      status: "completed",
      createdAt: { $gte: oneDayAgo },
    });

    const weeklyTransactions = await Transaction.find({
      email: user.email,
      source: "referral",
      status: "completed",
      createdAt: { $gte: oneWeekAgo },
    });

    const monthlyTransactions = await Transaction.find({
      email: user.email,
      source: "referral",
      status: "completed",
      createdAt: { $gte: oneMonthAgo },
    });

    // Count team members by level
    const membersByLevel = {
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0,
    };

    for (const member of teamMembers) {
      const level = `level${member.level}`;
      if (membersByLevel[level] !== undefined) {
        membersByLevel[level]++;
      }
    }

    // Calculate earnings by referral level
    const earningsByLevel = {
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0,
    };

    for (const reward of allRewards) {
      const level = `level${reward.referralLevel}`;
      if (earningsByLevel[level] !== undefined) {
        earningsByLevel[level] += reward.amount;
      }
    }

    // Calculate totals
    const totalEarnings = allTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );
    const dailyEarnings = dailyTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );
    const weeklyEarnings = weeklyTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );
    const monthlyEarnings = monthlyTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );

    // Get recent rewards (last 5)
    const recentRewards = await AffiliateReward.find({
      user: user._id,
    })
      .populate("referralUser", "name email level")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      earnings: {
        total: totalEarnings,
        daily: dailyEarnings,
        weekly: weeklyEarnings,
        monthly: monthlyEarnings,
        byLevel: earningsByLevel,
      },
      membersByLevel,
      recentRewards,
      totalRewardsCount: allRewards.length,
    });
  } catch (error) {
    console.error("Error getting team earnings:", error);
    res.status(500).json({ error: "Failed to get team earnings" });
  }
};
