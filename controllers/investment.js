// server/controllers/investment.js
const Investment = require("../models/investment");
const Wallet = require("../models/wallet");
const Transaction = require("../models/transaction");
const InvestmentPlan = require("../models/investmentPlan");

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
