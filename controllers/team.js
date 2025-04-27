// server/controllers/team.js
const User = require("../models/user");
const Wallet = require("../models/wallet");

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
