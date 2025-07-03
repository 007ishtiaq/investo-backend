// server/controllers/team.js
const User = require("../models/user");
const Wallet = require("../models/wallet");
const mongoose = require("mongoose");
const Investment = require("../models/investment");
const Transaction = require("../models/transaction");

// Get current user's team members with enhanced data

exports.getTeamMembers = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const founduser = await User.findOne({ email: userEmail });
    const userId = founduser._id;

    // Find all users who have this user as their referrer
    const teamMembers = await User.find({ referrer: userId })
      .select("name email level createdAt")
      .lean();

    // Enhanced team members with additional data
    const enhancedTeamMembers = await Promise.all(
      teamMembers.map(async (member) => {
        // Get first investment (oldest investment) with amount and plan details
        const firstInvestment = await Investment.findOne({
          user: member._id,
        })
          .sort({ createdAt: 1 })
          .populate("plan", "minLevel level planNumber");

        // Get the main user's level at the time of the member's first investment
        let mainUserLevelAtPurchase = founduser.level; // Default to current level

        if (firstInvestment) {
          // Find what the main user's level was at the time of this investment
          // We can do this by finding the main user's investment history up to that date
          const mainUserInvestmentsBeforeMemberPurchase = await Investment.find(
            {
              user: userId,
              createdAt: { $lte: firstInvestment.createdAt },
            }
          )
            .sort({ createdAt: -1 })
            .populate("plan", "minLevel level planNumber");

          // Get the highest level the main user had achieved by that time
          if (mainUserInvestmentsBeforeMemberPurchase.length > 0) {
            const levels = mainUserInvestmentsBeforeMemberPurchase.map(
              (inv) =>
                inv.plan?.minLevel ||
                inv.plan?.level ||
                inv.plan?.planNumber ||
                0
            );
            mainUserLevelAtPurchase = Math.max(...levels);
          } else {
            // If main user had no investments by that time, they were level 0
            mainUserLevelAtPurchase = 0;
          }
        }

        // Get commission earned from this specific member
        const commissionTransaction = await Transaction.findOne({
          email: userEmail,
          source: "referral",
          description: { $regex: new RegExp(member.email, "i") },
        });

        // If no direct match by email in description, find by pattern matching
        let commissionAmount = 0;
        if (commissionTransaction) {
          commissionAmount = commissionTransaction.amount;
        } else {
          // Alternative: Get all referral transactions and try to match timing
          const memberInvestments = await Investment.find({ user: member._id });
          if (memberInvestments.length > 0) {
            const firstInvestmentDate = memberInvestments[0].createdAt;
            // Find commission transaction around the same time (within 1 minute)
            const timeBuffer = new Date(firstInvestmentDate.getTime() + 60000);
            const timeBufferBefore = new Date(
              firstInvestmentDate.getTime() - 60000
            );

            const relatedCommission = await Transaction.findOne({
              email: userEmail,
              source: "referral",
              createdAt: { $gte: timeBufferBefore, $lte: timeBuffer },
            });

            if (relatedCommission) {
              commissionAmount = relatedCommission.amount;
            }
          }
        }

        // Privacy protection: mask name and email
        const maskedName =
          member.name.length > 5
            ? member.name.substring(0, 5) + "*****"
            : member.name + "*****";

        const maskedEmail =
          member.email.length > 5
            ? member.email.substring(0, 5) + "*****"
            : member.email + "*****";

        // Get the member's first purchase level
        const memberFirstPurchaseLevel =
          firstInvestment && firstInvestment.plan
            ? firstInvestment.plan.minLevel ||
              firstInvestment.plan.level ||
              firstInvestment.plan.planNumber
            : 0;

        return {
          ...member,
          name: maskedName,
          email: maskedEmail,
          memberCurrentLevel: member.level, // Member's current level
          memberFirstPurchaseLevel: memberFirstPurchaseLevel, // Member's first purchase level
          mainUserLevelAtPurchase: mainUserLevelAtPurchase, // Main user's level when member purchased
          firstInvestmentAmount: firstInvestment
            ? firstInvestment.amount
            : null,
          commissionEarned: commissionAmount,
          joinedDate: member.createdAt,
          firstInvestmentDate: firstInvestment
            ? firstInvestment.createdAt
            : null,
        };
      })
    );

    // Get statistics
    const totalTeamMembers = teamMembers.length;
    const totalActiveMembers = enhancedTeamMembers.filter(
      (member) => member.memberFirstPurchaseLevel > 0
    ).length;

    // Get earnings from affiliate program
    const user = await User.findById(userId);
    const affiliateEarnings = user.affiliateEarnings || 0;

    res.status(200).json({
      success: true,
      teamMembers: enhancedTeamMembers,
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

// not in my use - but will provide team earing by daily, mothly, total, weekly, 5 recent rewads with time
// exports.getTeamEarnings = async (req, res) => {
//   try {
//     const User = mongoose.model("User");
//     const Transaction = mongoose.model("Transaction");
//     const AffiliateReward = mongoose.model("AffiliateReward");

//     const user = await User.findOne({ email: req.user.email });

//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const teamMembers = await User.find({ referrer: user._id });

//     const now = new Date();
//     const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
//     const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
//     const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

//     const allRewards = await AffiliateReward.find({
//       user: user._id,
//     }).populate("referralUser", "name email level");

//     const allTransactions = await Transaction.find({
//       email: user.email,
//       source: "referral",
//       status: "completed",
//     });

//     const dailyTransactions = await Transaction.find({
//       email: user.email,
//       source: "referral",
//       status: "completed",
//       createdAt: { $gte: oneDayAgo },
//     });

//     const weeklyTransactions = await Transaction.find({
//       email: user.email,
//       source: "referral",
//       status: "completed",
//       createdAt: { $gte: oneWeekAgo },
//     });

//     const monthlyTransactions = await Transaction.find({
//       email: user.email,
//       source: "referral",
//       status: "completed",
//       createdAt: { $gte: oneMonthAgo },
//     });

//     const membersByLevel = {
//       level1: 0,
//       level2: 0,
//       level3: 0,
//       level4: 0,
//     };

//     for (const member of teamMembers) {
//       const level = `level${member.level}`;
//       if (membersByLevel[level] !== undefined) {
//         membersByLevel[level]++;
//       }
//     }

//     const earningsByLevel = {
//       level1: 0,
//       level2: 0,
//       level3: 0,
//       level4: 0,
//     };

//     for (const reward of allRewards) {
//       const level = `level${reward.referralLevel}`;
//       if (earningsByLevel[level] !== undefined) {
//         earningsByLevel[level] += reward.amount;
//       }
//     }

//     const totalEarnings = allTransactions.reduce(
//       (sum, tx) => sum + tx.amount,
//       0
//     );
//     const dailyEarnings = dailyTransactions.reduce(
//       (sum, tx) => sum + tx.amount,
//       0
//     );
//     const weeklyEarnings = weeklyTransactions.reduce(
//       (sum, tx) => sum + tx.amount,
//       0
//     );
//     const monthlyEarnings = monthlyTransactions.reduce(
//       (sum, tx) => sum + tx.amount,
//       0
//     );

//     // Get recent rewards (last 5)
//     const recentRewards = await AffiliateReward.find({
//       user: user._id,
//     })
//       .populate("referralUser", "name email level")
//       .sort({ createdAt: -1 })
//       .limit(5);

//     res.json({
//       success: true,
//       earnings: {
//         total: totalEarnings,
//         daily: dailyEarnings,
//         weekly: weeklyEarnings,
//         monthly: monthlyEarnings,
//         byLevel: earningsByLevel,
//       },
//       membersByLevel,
//       recentRewards,
//       totalRewardsCount: allRewards.length,
//     });
//   } catch (error) {
//     console.error("Error getting team earnings:", error);
//     res.status(500).json({ error: "Failed to get team earnings" });
//   }
// };
