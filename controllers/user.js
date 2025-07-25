// server/controllers/user.js (additions for level management)
const User = require("../models/user");
const Transaction = require("../models/transaction");
const Wallet = require("../models/wallet");
const InvestmentPlan = require("../models/investmentPlan");
const AffiliateReward = require("../models/AffiliateReward");
const Investment = require("../models/investment");

// Get all users for admin with wallet balances
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const email = req.query.email || "";

    let matchQuery = { role: "subscriber" };
    if (email) {
      matchQuery.email = { $regex: email, $options: "i" };
    }

    const users = await User.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: "wallets",
          localField: "email",
          foreignField: "email",
          as: "wallet",
        },
      },
      {
        $lookup: {
          from: "investments",
          localField: "_id",
          foreignField: "user",
          as: "investments",
        },
      },
      {
        $lookup: {
          from: "deposits",
          localField: "_id",
          foreignField: "user",
          as: "deposits",
        },
      },
      {
        $lookup: {
          from: "withdrawals",
          localField: "_id",
          foreignField: "user",
          as: "withdrawals",
        },
      },
      {
        $lookup: {
          from: "transactions",
          localField: "email",
          foreignField: "email",
          as: "transactions",
        },
      },
      {
        $addFields: {
          wallet: { $arrayElemAt: ["$wallet", 0] },
          totalInvestment: { $sum: "$investments.amount" },

          // Calculate total approved deposits
          totalDeposits: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$deposits",
                    cond: { $eq: ["$$this.status", "approved"] },
                  },
                },
                as: "deposit",
                in: "$$deposit.amount",
              },
            },
          },

          // Calculate total approved withdrawals
          totalWithdrawals: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$withdrawals",
                    cond: { $eq: ["$$this.status", "approved"] },
                  },
                },
                as: "withdrawal",
                in: "$$withdrawal.amount",
              },
            },
          },

          // Calculate task earnings from transactions
          taskEarnings: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$transactions",
                    cond: {
                      $and: [
                        { $eq: ["$$this.source", "task_reward"] },
                        { $eq: ["$$this.status", "completed"] },
                        { $eq: ["$$this.type", "credit"] },
                      ],
                    },
                  },
                },
                as: "transaction",
                in: "$$transaction.amount",
              },
            },
          },

          // Calculate team earnings (referral commissions) from transactions
          teamEarnings: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: "$transactions",
                    cond: {
                      $and: [
                        { $eq: ["$$this.source", "referral"] },
                        { $eq: ["$$this.status", "completed"] },
                        { $eq: ["$$this.type", "credit"] },
                      ],
                    },
                  },
                },
                as: "transaction",
                in: "$$transaction.amount",
              },
            },
          },

          purchasedLevels: {
            $reduce: {
              input: {
                $setUnion: {
                  $map: {
                    input: "$investments",
                    as: "investment",
                    in: {
                      $ifNull: [
                        "$$investment.plan.minLevel",
                        "$$investment.plan.level",
                      ],
                    },
                  },
                },
              },
              initialValue: "",
              in: {
                $cond: {
                  if: { $eq: ["$$value", ""] },
                  then: { $toString: "$$this" },
                  else: {
                    $concat: ["$$value", ", ", { $toString: "$$this" }],
                  },
                },
              },
            },
          },
        },
      },
      {
        $project: {
          // Remove the large arrays from final output to reduce response size
          deposits: 0,
          withdrawals: 0,
          transactions: 0,
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    // Get team information for each user
    const userIds = users.map((user) => user._id);

    // Count team members for each user (how many users have this user as referrer)
    const teamCounts = await User.aggregate([
      {
        $match: {
          referrer: { $in: userIds },
        },
      },
      {
        $group: {
          _id: "$referrer",
          count: { $sum: 1 },
          members: {
            $push: {
              _id: "$_id",
              name: "$name",
              email: "$email",
              level: "$level",
            },
          },
        },
      },
    ]);

    // Create a lookup map for team data
    const teamMap = {};
    teamCounts.forEach((team) => {
      teamMap[team._id.toString()] = {
        count: team.count,
        members: team.members.slice(0, 5), // Limit to first 5 members for performance
      };
    });

    // Add team information to each user
    const usersWithTeam = users.map((user) => ({
      ...user,
      team: teamMap[user._id.toString()] || {
        count: 0,
        members: [],
      },
    }));

    const total = await User.countDocuments(matchQuery);

    res.json({
      users: usersWithTeam,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
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

// Get user investments
exports.getUserInvestments = async (req, res) => {
  try {
    const founduser = await User.findOne({ email: req.user.email }).exec();
    const userId = founduser._id;

    const investments = await Investment.find({ user: userId })
      .populate("plan", "name minLevel dailyIncome")
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      investments: investments,
    });
  } catch (error) {
    console.error("Error fetching user investments:", error);
    res.status(500).json({ error: "Failed to fetch investments" });
  }
};

// Updated upgradePlan function - doesn't change user level for lower level plans
// exports.upgradePlan = async (req, res) => {
//   try {
//     const founduser = await User.findOne({ email: req.user.email }).exec();
//     const { planId, investmentAmount } = req.body;
//     const userId = founduser._id;

//     // Validate input
//     if (!planId || !investmentAmount) {
//       return res.status(400).json({
//         error: "Plan ID and investment amount are required",
//       });
//     }

//     const numInvestmentAmount = parseFloat(investmentAmount);
//     if (isNaN(numInvestmentAmount) || numInvestmentAmount <= 0) {
//       return res.status(400).json({
//         error: "Invalid investment amount",
//       });
//     }

//     // Find the user
//     const user = await User.findById(userId);
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     // Find the plan
//     const plan = await InvestmentPlan.findById(planId);
//     if (!plan) {
//       return res.status(404).json({ error: "Plan not found" });
//     }

//     // Validate investment amount against plan limits
//     if (numInvestmentAmount < plan.minAmount) {
//       return res.status(400).json({
//         error: `Minimum investment for this plan is $${plan.minAmount}`,
//       });
//     }

//     if (numInvestmentAmount > plan.maxAmount) {
//       return res.status(400).json({
//         error: `Maximum investment for this plan is $${plan.maxAmount}`,
//       });
//     }

//     // Find user's wallet
//     const wallet = await Wallet.findOne({ email: user.email });
//     if (!wallet) {
//       return res.status(404).json({ error: "Wallet not found" });
//     }

//     // Check if user has enough wallet balance
//     if (wallet.balance < numInvestmentAmount) {
//       return res.status(400).json({
//         error: "Insufficient wallet balance for this investment",
//       });
//     }

//     // Calculate end date based on plan duration
//     const startDate = new Date();
//     const endDate = new Date(startDate);
//     endDate.setDate(endDate.getDate() + plan.durationInDays);

//     // Create investment record
//     const investment = new Investment({
//       user: userId,
//       plan: planId,
//       amount: numInvestmentAmount,
//       initialAmount: numInvestmentAmount,
//       profit: 0,
//       status: "active",
//       startDate: startDate,
//       endDate: endDate,
//     });

//     // Save investment
//     await investment.save();

//     // Deduct amount from user's wallet balance
//     wallet.balance -= numInvestmentAmount;
//     wallet.lastUpdated = new Date();
//     await wallet.save();

//     // Only update user's level if this plan's level is higher than current level
//     // For lower level plans, just record the investment without changing user level
//     if (plan.minLevel > user.level) {
//       user.level = plan.minLevel;
//       await user.save();
//     }

//     // Populate the investment with plan and user details for response
//     const populatedInvestment = await Investment.findById(investment._id)
//       .populate("plan", "name minLevel dailyIncome")
//       .populate("user", "name email");

//     // Return success response
//     res.json({
//       success: true,
//       message: `Successfully invested $${numInvestmentAmount} in ${plan.name}`,
//       investment: populatedInvestment,
//       user: {
//         _id: user._id,
//         name: user.name,
//         email: user.email,
//         level: user.level,
//       },
//       wallet: {
//         balance: wallet.balance,
//         currency: wallet.currency,
//       },
//     });
//   } catch (error) {
//     console.error("Investment error:", error);
//     res
//       .status(500)
//       .json({ error: "An error occurred while processing your investment" });
//   }
// };

// Updated upgradePlan function with affiliate rewards
exports.upgradePlan = async (req, res) => {
  try {
    const founduser = await User.findOne({ email: req.user.email }).exec();
    const { planId, investmentAmount } = req.body;
    const userId = founduser._id;

    // Validate input
    if (!planId || !investmentAmount) {
      return res.status(400).json({
        error: "Plan ID and investment amount are required",
      });
    }

    const numInvestmentAmount = parseFloat(investmentAmount);
    if (isNaN(numInvestmentAmount) || numInvestmentAmount <= 0) {
      return res.status(400).json({
        error: "Invalid investment amount",
      });
    }

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the plan
    const plan = await InvestmentPlan.findById(planId);
    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    // Validate investment amount against plan limits
    if (numInvestmentAmount < plan.minAmount) {
      return res.status(400).json({
        error: `Minimum investment for this plan is $${plan.minAmount}`,
      });
    }

    if (numInvestmentAmount > plan.maxAmount) {
      return res.status(400).json({
        error: `Maximum investment for this plan is $${plan.maxAmount}`,
      });
    }

    // Find user's wallet
    const wallet = await Wallet.findOne({ email: user.email });
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Check if user has enough wallet balance
    if (wallet.balance < numInvestmentAmount) {
      return res.status(400).json({
        error: "Insufficient wallet balance for this investment",
      });
    }

    // Check if this is user's first plan purchase
    const existingInvestments = await Investment.find({ user: userId });
    const isFirstPurchase = existingInvestments.length === 0;

    // Calculate end date based on plan duration
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.durationInDays);

    // Create investment record
    const investment = new Investment({
      user: userId,
      plan: planId,
      amount: numInvestmentAmount,
      initialAmount: numInvestmentAmount,
      profit: 0,
      status: "active",
      startDate: startDate,
      endDate: endDate,
    });

    // Save investment
    await investment.save();

    // Deduct amount from user's wallet balance
    wallet.balance -= numInvestmentAmount;
    wallet.lastUpdated = new Date();
    await wallet.save();

    // Create transaction record for plan purchase (debit transaction)
    const transaction = new Transaction({
      email: user.email,
      walletId: wallet._id,
      amount: numInvestmentAmount,
      type: "debit",
      status: "completed",
      source: "other",
      description: `Plan purchase - ${plan.name} (Level ${plan.minLevel})`,
      reference: investment._id.toString(),
      metadata: {
        planId: planId,
        planName: plan.name,
        planLevel: plan.minLevel,
        investmentId: investment._id,
      },
    });

    await transaction.save();

    // Only update user's level if this plan's level is higher than current level
    if (plan.minLevel > user.level) {
      user.level = plan.minLevel;
      await user.save();
    }

    // Process affiliate rewards if this is first purchase and user has a referrer
    if (isFirstPurchase && user.referrer) {
      await processAffiliateRewards(
        user.referrer,
        plan.minLevel,
        numInvestmentAmount
      );
    }

    // Populate the investment with plan and user details for response
    const populatedInvestment = await Investment.findById(investment._id)
      .populate("plan", "name minLevel dailyIncome")
      .populate("user", "name email");

    // Return success response
    res.json({
      success: true,
      message: `Successfully invested $${numInvestmentAmount} in ${plan.name}`,
      investment: populatedInvestment,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        level: user.level,
      },
      wallet: {
        balance: wallet.balance,
        currency: wallet.currency,
      },
    });
  } catch (error) {
    console.error("Investment error:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your investment" });
  }
};

// Helper function to process affiliate rewards
const processAffiliateRewards = async (
  referrerId,
  purchasedPlanLevel,
  investmentAmount
) => {
  try {
    // Find the referrer
    const referrer = await User.findById(referrerId);
    if (!referrer) {
      console.log("Referrer not found");
      return;
    }

    // Commission rates based on your table
    const getCommissionRate = (referrerLevel, planLevel) => {
      const rates = {
        1: { 1: 0.1, 2: 0.15, 3: 0.2, 4: 0.25 }, // Level 1 account rates
        2: { 1: 0.15, 2: 0.2, 3: 0.25, 4: 0.3 }, // Level 2 account rates
        3: { 1: 0.2, 2: 0.25, 3: 0.3, 4: 0.35 }, // Level 3 account rates
        4: { 1: 0.25, 2: 0.3, 3: 0.35, 4: 0.4 }, // Level 4 account rates
      };

      return rates[referrerLevel]?.[planLevel] || 0;
    };

    // Calculate commission based on referrer's level and purchased plan level
    const commissionRate = getCommissionRate(
      referrer.level,
      purchasedPlanLevel
    );
    const commissionAmount = investmentAmount * commissionRate;

    if (commissionAmount > 0) {
      // Find referrer's wallet
      const referrerWallet = await Wallet.findOne({ email: referrer.email });
      if (!referrerWallet) {
        console.log("Referrer wallet not found");
        return;
      }

      // Update referrer's affiliate earnings and wallet balance
      referrer.affiliateEarnings += commissionAmount;
      await referrer.save();

      referrerWallet.balance += commissionAmount;
      referrerWallet.lastUpdated = new Date();
      await referrerWallet.save();

      // Create transaction record for the affiliate reward
      const transaction = new Transaction({
        email: referrer.email,
        walletId: referrerWallet._id,
        amount: commissionAmount,
        type: "credit",
        status: "completed",
        source: "referral",
        description: `Affiliate commission from Level ${purchasedPlanLevel} plan purchase ($${investmentAmount.toFixed(
          2
        )}) - ${(commissionRate * 100).toFixed(0)}% commission`,
        reference: `AF-${Date.now()}`,
      });

      await transaction.save();

      console.log(
        `Affiliate reward processed: $${commissionAmount.toFixed(2)} to ${
          referrer.email
        } for Level ${purchasedPlanLevel} plan purchase`
      );
    }
  } catch (error) {
    console.error("Error processing affiliate rewards:", error);
  }
};

// Get user level (for client-side)
exports.getUserLevel = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email }).select("level");
    console.log(user);

    res.json({
      level: user.level,
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
    const {
      name,
      email,
      contact,
      role,
      affiliateCode,
      level,
      _id,
      profileImage,
      notifications,
    } = user;

    res.json({
      _id,
      name,
      email,
      contact,
      role,
      affiliateCode,
      level,
      profileImage,
      notifications,
    });
  } catch (error) {
    console.error("GET CURRENT USER ERROR", error);
    res.status(500).json({ error: "Server error" });
  }
};

// Update user profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, contact, profileImage } = req.body;

    // Validate input
    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }
    // Prepare update object
    const updateData = { name, contact };

    // Only add profileImage to update if it exists
    if (profileImage) {
      updateData.profileImage = profileImage;
    }
    // Find and update user
    const updated = await User.findOneAndUpdate(
      { email: req.user.email },
      updateData,
      { new: true }
    ).exec();
    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }
    // Don't send sensitive information
    const {
      email,
      role,
      affiliateCode,
      level,
      _id,
      profileImage: updatedProfileImage,
    } = updated;
    res.json({
      _id,
      name: updated.name,
      email,
      contact: updated.contact,
      role,
      affiliateCode,
      level,
      profileImage: updatedProfileImage,
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

exports.getAffiliateRewards = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get user from authentication
    const user = await User.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get rewards with pagination
    const rewards = await AffiliateReward.find({ user: user._id })
      .populate("referralUser", "name email level")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const total = await AffiliateReward.countDocuments({ user: user._id });

    res.json({
      success: true,
      rewards,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching affiliate rewards:", error);
    res.status(500).json({ error: "Failed to fetch affiliate rewards" });
  }
};
