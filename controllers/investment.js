// server/controllers/investment.js
const Investment = require("../models/investment");
const Wallet = require("../models/wallet");
const Transaction = require("../models/transaction");
const User = require("../models/user");

// For admin: Get all investments
exports.getAllInvestments = async (req, res) => {
  try {
    const investments = await Investment.find({})
      .sort({ createdAt: -1 })
      .populate("user", "email username")
      .populate("plan", "name returnRate durationInDays")
      .exec();

    res.json(investments);
  } catch (error) {
    console.error("Get all investments error:", error);
    res.status(500).json({ error: "Failed to fetch all investments" });
  }
};

// Calculate and distribute daily profits (for cron job)
exports.distributeDailyProfits = async (req, res) => {
  try {
    const activeInvestments = await Investment.find({
      status: "active",
      endDate: { $gt: new Date() },
    })
      .populate("plan")
      .populate("user");

    let processedCount = 0;

    for (const investment of activeInvestments) {
      // Skip if profit already distributed today
      if (
        investment.lastProfitDate &&
        new Date().toDateString() === investment.lastProfitDate.toDateString()
      ) {
        continue;
      }

      const plan = investment.plan;

      // Calculate daily profit
      let dailyProfit;

      if (plan.isFixedDeposit) {
        // For fixed deposits, calculate based on total return divided by duration
        const totalReturn = (investment.initialAmount * plan.returnRate) / 100;
        dailyProfit = totalReturn / plan.durationInDays;
      } else {
        // For daily income plans, use dailyIncome rate
        dailyProfit = (investment.amount * plan.dailyIncome) / 100;
      }

      // Update investment
      investment.profit += dailyProfit;
      investment.lastProfitDate = new Date();
      await investment.save();

      // Update user's wallet
      const wallet = await Wallet.findOne({ user: investment.user._id });

      if (wallet) {
        wallet.balance += dailyProfit;
        await wallet.save();

        // Record transaction
        await new Transaction({
          user: investment.user._id,
          amount: dailyProfit,
          type: "profit",
          status: "completed",
          source: "investment_profit",
          reference: investment._id,
          description: `Daily profit from ${plan.name} investment`,
        }).save();

        processedCount++;
      }
    }

    // Check for completed investments
    const completedInvestments = await Investment.find({
      status: "active",
      endDate: { $lte: new Date() },
    }).populate("plan");

    for (const investment of completedInvestments) {
      // Mark as completed
      investment.status = "completed";
      await investment.save();

      // Return principal for fixed deposits
      if (investment.plan.isFixedDeposit) {
        const wallet = await Wallet.findOne({ user: investment.user });

        if (wallet) {
          wallet.balance += investment.initialAmount;
          await wallet.save();

          // Record transaction
          await new Transaction({
            user: investment.user,
            amount: investment.initialAmount,
            type: "principal_return",
            status: "completed",
            source: "investment_completed",
            reference: investment._id,
            description: `Principal returned from completed ${investment.plan.name} investment`,
          }).save();
        }
      }
    }

    res.json({
      success: true,
      message: `Processed daily profits for ${processedCount} investments`,
      completedInvestments: completedInvestments.length,
    });
  } catch (error) {
    console.error("Distribute profits error:", error);
    res.status(500).json({ error: "Failed to distribute profits" });
  }
};

exports.getUserInvestments = async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify that the requesting user has admin privileges
    const requestingUser = req.user;

    // Optional: Add admin check if this is admin-only functionality
    // if (requestingUser.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Access denied. Admin privileges required."
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

    // Get all investments for this user
    const investments = await Investment.find({ user: userId })
      .populate(
        "plan",
        "name description minAmount maxAmount durationInDays returnRate minLevel"
      )
      .sort({ createdAt: -1 })
      .lean();

    // Calculate investment statistics
    const stats = {
      totalInvestment: 0,
      activeInvestments: 0,
      completedInvestments: 0,
      totalProfit: 0,
      investmentsByLevel: {},
    };

    investments.forEach((investment) => {
      // Total investment amount
      stats.totalInvestment += investment.initialAmount || investment.amount;

      // Total profit
      stats.totalProfit += investment.profit || 0;

      // Count by status
      if (investment.status === "active") {
        stats.activeInvestments++;
      } else if (investment.status === "completed") {
        stats.completedInvestments++;
      }

      // Group by level
      const level = investment.plan?.minLevel || 0;
      if (!stats.investmentsByLevel[level]) {
        stats.investmentsByLevel[level] = {
          totalAmount: 0,
          count: 0,
          profit: 0,
        };
      }

      stats.investmentsByLevel[level].totalAmount +=
        investment.initialAmount || investment.amount;
      stats.investmentsByLevel[level].count++;
      stats.investmentsByLevel[level].profit += investment.profit || 0;
    });

    // Get related transactions for plan purchases
    const planPurchaseTransactions = await Transaction.find({
      email: targetUser.email,
      source: "other",
      description: { $regex: /plan purchase/i },
      status: "completed",
    }).lean();

    // Enhanced investments with transaction details
    const enhancedInvestments = investments.map((investment) => {
      // Find corresponding plan purchase transaction
      const relatedTransaction = planPurchaseTransactions.find(
        (tx) =>
          tx.reference === investment._id.toString() ||
          (tx.description && tx.description.includes(investment.plan?.name)) ||
          Math.abs(tx.amount - investment.amount) < 0.01
      );

      return {
        ...investment,
        relatedTransaction: relatedTransaction
          ? {
              _id: relatedTransaction._id,
              amount: relatedTransaction.amount,
              description: relatedTransaction.description,
              createdAt: relatedTransaction.createdAt,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        investments: enhancedInvestments,
        stats,
        targetUser: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          level: targetUser.level,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching user investments:", err);

    if (err.message && err.message.includes("401")) {
      res.status(500).json({
        success: false,
        message: "Session Expired, Please reload the page",
        error: err.message,
      });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to fetch user investments",
        error: err.message,
      });
    }
  }
};

// Additional helper function for getting current user's investments
exports.getMyInvestments = async (req, res) => {
  try {
    const userEmail = req.user.email;
    const foundUser = await User.findOne({ email: userEmail });
    const userId = foundUser._id;

    const investments = await Investment.find({ user: userId })
      .populate(
        "plan",
        "name description minAmount maxAmount durationInDays returnRate minLevel"
      )
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        investments,
        user: {
          _id: foundUser._id,
          name: foundUser.name,
          email: foundUser.email,
          level: foundUser.level,
        },
      },
    });
  } catch (err) {
    console.error("Error fetching my investments:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch investments",
      error: err.message,
    });
  }
};
