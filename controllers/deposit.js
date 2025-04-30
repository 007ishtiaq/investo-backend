// server/controllers/deposit.js
const Deposit = require("../models/deposit");
const User = require("../models/user");
const Investment = require("../models/investment");
const InvestmentPlan = require("../models/investmentPlan");
const Wallet = require("../models/wallet");
const Transaction = require("../models/transaction");

// Create a new deposit request
exports.createDeposit = async (req, res) => {
  try {
    const { amount, paymentMethod, transactionId, screenshotUrl } = req.body;

    if (!amount || !paymentMethod || !screenshotUrl) {
      return res.status(400).json({
        error: "Amount, payment method, and screenshot are required",
      });
    }

    const newDeposit = await new Deposit({
      user: req.user._id,
      amount,
      paymentMethod,
      transactionId,
      screenshotUrl,
    }).save();

    res.json(newDeposit);
  } catch (error) {
    console.error("Create deposit error:", error);
    res.status(500).json({ error: "Failed to create deposit request" });
  }
};

// Get user's deposit history
exports.getUserDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate("assignedPlan", "name durationInDays returnRate")
      .exec();

    res.json(deposits);
  } catch (error) {
    console.error("Get user deposits error:", error);
    res.status(500).json({ error: "Failed to fetch deposit history" });
  }
};

// For admin: Get all deposit requests
exports.getAllDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({})
      .sort({ createdAt: -1 })
      .populate("user", "email username")
      .populate("assignedPlan", "name")
      .populate("approvedBy", "email username")
      .exec();

    res.json(deposits);
  } catch (error) {
    console.error("Get all deposits error:", error);
    res.status(500).json({ error: "Failed to fetch all deposits" });
  }
};

// For admin: Get pending deposits
exports.getPendingDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.find({ status: "pending" })
      .sort({ createdAt: -1 })
      .populate("user", "email username")
      .exec();

    res.json(deposits);
  } catch (error) {
    console.error("Get pending deposits error:", error);
    res.status(500).json({ error: "Failed to fetch pending deposits" });
  }
};

// For admin: Approve or reject deposit
exports.reviewDeposit = async (req, res) => {
  try {
    const { depositId } = req.params;
    const { status, planId, adminNotes } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const deposit = await Deposit.findById(depositId);

    if (!deposit) {
      return res.status(404).json({ error: "Deposit not found" });
    }

    if (deposit.status !== "pending") {
      return res.status(400).json({ error: "Deposit already processed" });
    }

    // Update deposit status
    deposit.status = status;
    deposit.adminNotes = adminNotes;
    deposit.approvedBy = req.user._id;
    deposit.approvedAt = new Date();

    if (status === "approved" && planId) {
      const plan = await InvestmentPlan.findById(planId);

      if (!plan) {
        return res.status(404).json({ error: "Investment plan not found" });
      }

      deposit.assignedPlan = planId;

      // Create investment for user
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.durationInDays);

      const newInvestment = await new Investment({
        user: deposit.user,
        plan: planId,
        amount: deposit.amount,
        initialAmount: deposit.amount,
        endDate,
        deposit: depositId,
      }).save();

      // Update user's wallet
      const wallet = await Wallet.findOne({ user: deposit.user });

      if (wallet) {
        // Record transaction
        await new Transaction({
          user: deposit.user,
          amount: deposit.amount,
          type: "deposit",
          status: "completed",
          source: "deposit_investment",
          reference: deposit._id,
          description: `Deposit approved for investment in ${plan.name}`,
        }).save();
      } else {
        // Create wallet if it doesn't exist
        await new Wallet({
          user: deposit.user,
          balance: 0,
        }).save();

        // Record transaction
        await new Transaction({
          user: deposit.user,
          amount: deposit.amount,
          type: "deposit",
          status: "completed",
          source: "deposit_investment",
          reference: deposit._id,
          description: `Deposit approved for investment in ${plan.name}`,
        }).save();
      }
    }

    await deposit.save();
    res.json(deposit);
  } catch (error) {
    console.error("Review deposit error:", error);
    res.status(500).json({ error: "Failed to process deposit request" });
  }
};
