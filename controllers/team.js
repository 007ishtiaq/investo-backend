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
        if (firstInvestment) {
          // Method 1: Try to find commission by investment amount in description
          const investmentAmount = firstInvestment.amount;
          const commissionByAmount = await Transaction.findOne({
            email: userEmail,
            source: "referral",
            status: "completed",
            description: {
              $regex: new RegExp(`\\$${investmentAmount}\\.00`, "i"),
            },
            // Look for transactions created around the time of the investment
            createdAt: {
              $gte: new Date(
                firstInvestment.createdAt.getTime() - 2 * 60 * 1000
              ), // 2 minutes before
              $lte: new Date(
                firstInvestment.createdAt.getTime() + 2 * 60 * 1000
              ), // 2 minutes after
            },
          });
          if (commissionByAmount) {
            commissionAmount = commissionByAmount.amount;
          } else {
            // Method 2: Try to find by reference pattern and timing
            const commissionByTiming = await Transaction.findOne({
              email: userEmail,
              source: "referral",
              status: "completed",
              createdAt: {
                $gte: new Date(
                  firstInvestment.createdAt.getTime() - 2 * 60 * 1000
                ),
                $lte: new Date(
                  firstInvestment.createdAt.getTime() + 2 * 60 * 1000
                ),
              },
            });
            if (commissionByTiming) {
              // Additional verification: check if the commission amount makes sense
              // For example, if it's 25% of the investment amount
              const expectedCommission = investmentAmount * 0.25;
              if (
                Math.abs(commissionByTiming.amount - expectedCommission) < 0.01
              ) {
                commissionAmount = commissionByTiming.amount;
              }
            }
          }
          // Method 3: If still no match, try broader search with calculation verification
          if (commissionAmount === 0) {
            const allCommissions = await Transaction.find({
              email: userEmail,
              source: "referral",
              status: "completed",
              createdAt: {
                $gte: new Date(
                  firstInvestment.createdAt.getTime() - 5 * 60 * 1000
                ), // 5 minutes window
                $lte: new Date(
                  firstInvestment.createdAt.getTime() + 5 * 60 * 1000
                ),
              },
            }).sort({ createdAt: 1 });
            // Try to match by expected commission calculation
            for (const commission of allCommissions) {
              // Check if this commission could be from this investment
              // Assuming 25% commission rate - adjust based on your actual rates
              const possibleInvestmentAmount = commission.amount / 0.25;
              if (Math.abs(possibleInvestmentAmount - investmentAmount) < 1) {
                commissionAmount = commission.amount;
                break;
              }
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

exports.getTeamMembersByUserId = async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify that the requesting user has admin privileges or is requesting their own data
    const requestingUser = req.user;

    // Optional: Add admin check if this is admin-only functionality
    // if (requestingUser.role !== 'admin' && requestingUser._id.toString() !== userId) {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Access denied. Insufficient permissions."
    //   });
    // }

    // Find the target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

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

        // Get the target user's level at the time of the member's first investment
        let targetUserLevelAtPurchase = targetUser.level; // Default to current level

        if (firstInvestment) {
          // Find what the target user's level was at the time of this investment
          const targetUserInvestmentsBeforeMemberPurchase =
            await Investment.find({
              user: userId,
              createdAt: { $lte: firstInvestment.createdAt },
            })
              .sort({ createdAt: -1 })
              .populate("plan", "minLevel level planNumber");

          // Get the highest level the target user had achieved by that time
          if (targetUserInvestmentsBeforeMemberPurchase.length > 0) {
            const levels = targetUserInvestmentsBeforeMemberPurchase.map(
              (inv) =>
                inv.plan?.minLevel ||
                inv.plan?.level ||
                inv.plan?.planNumber ||
                0
            );
            targetUserLevelAtPurchase = Math.max(...levels);
          } else {
            // If target user had no investments by that time, they were level 0
            targetUserLevelAtPurchase = 0;
          }
        }

        // Get commission earned from this specific member
        let commissionAmount = 0;
        if (firstInvestment) {
          // Method 1: Try to find commission by investment amount in description
          const investmentAmount = firstInvestment.amount;
          const commissionByAmount = await Transaction.findOne({
            email: targetUser.email,
            source: "referral",
            status: "completed",
            description: {
              $regex: new RegExp(`\\$${investmentAmount}\\.00`, "i"),
            },
            // Look for transactions created around the time of the investment
            createdAt: {
              $gte: new Date(
                firstInvestment.createdAt.getTime() - 2 * 60 * 1000
              ), // 2 minutes before
              $lte: new Date(
                firstInvestment.createdAt.getTime() + 2 * 60 * 1000
              ), // 2 minutes after
            },
          });

          if (commissionByAmount) {
            commissionAmount = commissionByAmount.amount;
          } else {
            // Method 2: Try to find by reference pattern and timing
            const commissionByTiming = await Transaction.findOne({
              email: targetUser.email,
              source: "referral",
              status: "completed",
              createdAt: {
                $gte: new Date(
                  firstInvestment.createdAt.getTime() - 2 * 60 * 1000
                ),
                $lte: new Date(
                  firstInvestment.createdAt.getTime() + 2 * 60 * 1000
                ),
              },
            });

            if (commissionByTiming) {
              // Additional verification: check if the commission amount makes sense
              const expectedCommission = investmentAmount * 0.25;
              if (
                Math.abs(commissionByTiming.amount - expectedCommission) < 0.01
              ) {
                commissionAmount = commissionByTiming.amount;
              }
            }
          }

          // Method 3: If still no match, try broader search with calculation verification
          if (commissionAmount === 0) {
            const allCommissions = await Transaction.find({
              email: targetUser.email,
              source: "referral",
              status: "completed",
              createdAt: {
                $gte: new Date(
                  firstInvestment.createdAt.getTime() - 5 * 60 * 1000
                ), // 5 minutes window
                $lte: new Date(
                  firstInvestment.createdAt.getTime() + 5 * 60 * 1000
                ),
              },
            }).sort({ createdAt: 1 });

            // Try to match by expected commission calculation
            for (const commission of allCommissions) {
              // Check if this commission could be from this investment
              const possibleInvestmentAmount = commission.amount / 0.25;
              if (Math.abs(possibleInvestmentAmount - investmentAmount) < 1) {
                commissionAmount = commission.amount;
                break;
              }
            }
          }
        }

        // Privacy protection: mask name and email for admin view
        const maskedName =
          member.name && member.name.length > 5
            ? member.name.substring(0, 5) + "*****"
            : (member.name || "Unknown") + "*****";

        const maskedEmail =
          member.email && member.email.length > 5
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
          mainUserLevelAtPurchase: targetUserLevelAtPurchase, // Target user's level when member purchased
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

    // Get earnings from affiliate program for the target user
    const affiliateEarnings = targetUser.affiliateEarnings || 0;

    res.status(200).json({
      success: true,
      data: {
        teamMembers: enhancedTeamMembers,
        stats: {
          totalMembers: totalTeamMembers,
          activeMembers: totalActiveMembers,
          affiliateEarnings,
        },
        targetUser: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          level: targetUser.level,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching team members by user ID:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch team members",
      error: err.message,
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
