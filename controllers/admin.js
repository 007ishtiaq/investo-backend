// server/controllers/admin.js
const UserTask = require("../models/userTask");
const Task = require("../models/tasks");
const { creditToWallet } = require("./wallet");
const User = require("../models/user");
const { creditRewardToWallet } = require("./task");
// server/controllers/adminWithdrawal.js
const Withdrawal = require("../models/withdrawal");
const Transaction = require("../models/transaction");
const Wallet = require("../models/wallet");
const InvestmentPlan = require("../models/investmentPlan");
const Deposit = require("../models/deposit");
const Investment = require("../models/investment");

const {
  transporter,
  withdrawalApprovalTemplate,
  withdrawalRejectionTemplate,
} = require("../middlewares/utils");

// Task verification and reward crediting
// Task verification and reward crediting
exports.approveTask = async (req, res) => {
  try {
    // Change this line to match the route parameter name
    const userTaskId = req.params.userTaskId; // Changed from req.params.id
    console.log("Processing approval for userTaskId:", userTaskId);

    // Find the user task submission
    const userTask = await UserTask.findById(userTaskId);
    if (!userTask) {
      return res
        .status(404)
        .json({ success: false, message: "Task submission not found" });
    }

    // Find the task to get reward amount
    const task = await Task.findById(userTask.taskId);
    if (!task) {
      return res
        .status(404)
        .json({ success: false, message: "Task not found" });
    }

    // Update user task status
    userTask.status = "approved";
    userTask.verified = true;
    userTask.completed = true;
    userTask.completedAt = new Date();

    // Find the user email for wallet crediting - this is important
    const user = await User.findById(userTask.userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Credit reward to wallet using email
    try {
      await creditRewardToWallet(
        user.email, // Use user's email instead of userId
        task.reward,
        "task_reward", // Make sure this matches your Transaction schema enum
        `Admin approved reward for "${task.title}"`
      );
      console.log(`Reward of ${task.reward} credited to ${user.email}`);
    } catch (walletError) {
      console.error("Error crediting wallet:", walletError);
      return res.status(500).json({
        success: false,
        message: "Failed to credit reward: " + walletError.message,
      });
    }

    // Save the updated user task
    await userTask.save();

    res.status(200).json({
      success: true,
      message: `Task approved and ${task.reward.toFixed(
        3
      )} USD credited to user's wallet`,
    });
  } catch (err) {
    console.error("Error approving task:", err);
    res.status(500).json({
      success: false,
      message: "Failed to approve task: " + err.message,
    });
  }
};

// You would use the same creditRewardToWallet helper function here

// Reject task (no reward)
exports.rejectTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    const userTask = await UserTask.findById(id);

    if (!userTask) {
      return res.status(404).json({ error: "Task submission not found" });
    }

    userTask.status = "rejected";
    userTask.rejectionReason = rejectionReason;
    userTask.rejectedAt = Date.now();
    userTask.rejectedBy = req.user._id;

    await userTask.save();

    res.status(200).json({
      success: true,
      message: "Task rejected",
    });
  } catch (error) {
    console.error("Error rejecting task:", error);
    res.status(500).json({ error: "Failed to reject task" });
  }
};

// Get all withdrawals with optional status filter
exports.getWithdrawals = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    // Apply status filter if provided
    if (status && status !== "all") {
      query.status = status;
    }

    const withdrawals = await Withdrawal.find(query)
      .populate("user", "email username level") // Add level to the populated fields
      .populate("processedBy", "email username")
      .sort({ createdAt: -1 });

    // Get wallet balances for each user
    const withdrawalsWithWalletInfo = await Promise.all(
      withdrawals.map(async (withdrawal) => {
        const wallet = await Wallet.findOne({ email: withdrawal.user.email });

        // Convert to plain object so we can add wallet info
        const withdrawalObj = withdrawal.toObject();
        withdrawalObj.userWalletBalance = wallet ? wallet.balance : 0;
        return withdrawalObj;
      })
    );

    res.json(withdrawalsWithWalletInfo);
  } catch (error) {
    console.error("GET WITHDRAWALS ERROR:", error);
    res.status(500).json({ error: "Error fetching withdrawals" });
  }
};

// Get a specific withdrawal by ID
exports.getWithdrawalById = async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id)
      .populate("user", "email username")
      .populate("processedBy", "email username");
    if (!withdrawal) {
      return res.status(404).json({ error: "Withdrawal not found" });
    }
    res.json(withdrawal);
  } catch (error) {
    console.error("GET WITHDRAWAL ERROR:", error);
    res.status(500).json({ error: "Error fetching withdrawal" });
  }
};

// Send email to user when withdrawal is processed
const sendWithdrawalProcessedEmail = async (withdrawal, user) => {
  try {
    // Check if user has email notifications enabled
    if (!user.notifications || !user.notifications.deposits) {
      console.log(`User ${user.email} has disabled deposit notifications`);
      return; // Don't send email if user has disabled notifications
    }

    // Get the appropriate email template
    let emailHtml;
    let subject;

    if (withdrawal.status === "approved") {
      subject = "Your Withdrawal Has Been Approved";
      emailHtml = withdrawalApprovalTemplate(withdrawal);
    } else if (withdrawal.status === "rejected") {
      subject = "Update on Your Withdrawal Request";
      emailHtml = withdrawalRejectionTemplate(
        withdrawal,
        withdrawal.adminNotes
      );
    } else {
      // If status is not approved or rejected, don't send an email
      return;
    }

    // Use Mailjet to send the email
    const mailjet = require("node-mailjet").connect(
      process.env.MAILJET_API_KEY,
      process.env.MAILJET_SECRET_KEY
    );

    const request = mailjet.post("send", { version: "v3.1" }).request({
      Messages: [
        {
          From: {
            Email: process.env.EMAIL_FROM,
            Name: "Investo",
          },
          To: [
            {
              Email: user.email,
              Name: user.name || user.email,
            },
          ],
          Subject: subject,
          HTMLPart: emailHtml,
        },
      ],
    });

    await request;
    console.log(`Withdrawal ${withdrawal.status} email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error("Error sending withdrawal processed email:", error);
    return false;
  }
};

// Review (approve or reject) a withdrawal
exports.reviewWithdrawal = async (req, res) => {
  try {
    const { status, adminNotes, transactionId, planId } = req.body;
    const withdrawalId = req.params.id;

    // Validate the status
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Find the withdrawal
    const withdrawal = await Withdrawal.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({ error: "Withdrawal not found" });
    }

    // Check if withdrawal is already processed
    if (withdrawal.status !== "pending") {
      return res
        .status(400)
        .json({ error: "Withdrawal has already been processed" });
    }

    // For approved withdrawal, verify transaction ID
    if (status === "approved" && !transactionId) {
      return res
        .status(400)
        .json({ error: "Transaction ID is required for approved withdrawals" });
    }

    // Find the user and their wallet
    const user = await User.findById(withdrawal.user);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const wallet = await Wallet.findOne({ email: user.email });
    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Find the pending transaction for this withdrawal
    const pendingTransaction = await Transaction.findOne({
      reference: withdrawal._id.toString(),
      source: "withdrawal",
      status: "pending",
    });

    if (status === "rejected") {
      // Credit the wallet back
      wallet.balance += withdrawal.amount;
      wallet.lastUpdated = new Date();
      await wallet.save();

      // If we found a pending transaction, update its status to rejected
      if (pendingTransaction) {
        pendingTransaction.status = "failed";
        pendingTransaction.description = "Withdrawal request rejected";
        await pendingTransaction.save();
      }

      // Create a new credit transaction record for the returned funds
      await Transaction.create({
        email: user.email,
        walletId: wallet._id,
        amount: withdrawal.amount,
        type: "credit",
        status: "completed",
        source: "withdrawal",
        description: "Withdrawal request rejected, funds returned to wallet",
        metadata: {
          withdrawalId: withdrawal._id,
        },
      });
    } else if (status === "approved") {
      // Deduct from wallet balance if not already deducted
      // First check if the wallet has sufficient balance
      if (wallet.balance < withdrawal.amount) {
        return res.status(400).json({
          error: "Insufficient wallet balance to process this withdrawal",
        });
      }

      // Deduct the amount from the wallet
      wallet.balance -= withdrawal.amount;
      wallet.lastUpdated = new Date();
      await wallet.save();

      // If we found a pending transaction, update its status to completed
      if (pendingTransaction) {
        pendingTransaction.status = "completed";
        pendingTransaction.description = `Withdrawal via ${withdrawal.paymentMethod} completed`;
        pendingTransaction.reference = `${withdrawal._id.toString()}-${transactionId}`;
        await pendingTransaction.save();
      } else {
        // If no pending transaction found (unlikely, but as a fallback), create a completed one
        await Transaction.create({
          email: user.email,
          walletId: wallet._id,
          amount: withdrawal.amount,
          type: "debit",
          status: "completed",
          source: "withdrawal",
          description: `Withdrawal via ${withdrawal.paymentMethod} completed`,
          reference: `${withdrawal._id.toString()}-${transactionId}`,
          metadata: {
            withdrawalId: withdrawal._id,
          },
        });
      }

      // If an investment plan was selected, update the user's level
      if (planId) {
        const plan = await InvestmentPlan.findById(planId);
        if (plan && plan.minLevel) {
          user.level = plan.minLevel;
          await user.save();
        }
      }
    }

    // Update the withdrawal
    withdrawal.status = status;
    withdrawal.adminNotes = adminNotes;
    withdrawal.processedBy = req.user._id;
    withdrawal.processedAt = new Date();

    if (status === "approved") {
      withdrawal.transactionId = transactionId;
    }

    // If a plan was selected, record it
    if (planId) {
      withdrawal.assignedPlan = planId;
    }

    await withdrawal.save();

    // Send email notification to user after withdrawal is processed
    try {
      await sendWithdrawalProcessedEmail(withdrawal, user);
    } catch (emailError) {
      console.error("EMAIL SENDING ERROR:", emailError);
      // Don't fail the API response if email fails
    }

    res.json({ success: true, message: `Withdrawal ${status} successfully` });
  } catch (error) {
    console.error("REVIEW WITHDRAWAL ERROR:", error);
    res.status(500).json({ error: "Error processing withdrawal" });
  }
};

exports.getAdminAnalytics = async (req, res) => {
  try {
    // Get financial data
    const totalDepositAmount = await Transaction.aggregate([
      {
        $match: {
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
    const totalWithdrawalAmount = await Transaction.aggregate([
      {
        $match: {
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
    const totalRewardsAmount = await Transaction.aggregate([
      {
        $match: {
          $or: [
            { source: "task_reward" },
            { source: "referral" },
            { source: "bonus" },
          ],
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
    // Get total platform balance
    const totalWalletBalance = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: "$balance" },
        },
      },
    ]);
    // Get user stats
    const totalUsers = await User.countDocuments({ role: "subscriber" });
    const activeInvestors = await Investment.countDocuments({
      status: "active",
    });
    const totalTeams = await User.countDocuments({
      referrer: { $exists: true, $ne: null },
    });

    // Average user balance
    const avgUserBalance = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          avgBalance: { $avg: "$balance" },
        },
      },
    ]);

    // Get task stats
    const totalTasks = await Task.countDocuments();
    const completedTasks = await UserTask.countDocuments({
      status: "completed",
    });
    const pendingTasks = await UserTask.countDocuments({
      status: "pending_verification",
    });
    const rejectedTasks = await UserTask.countDocuments({ status: "rejected" });

    // Get pending deposits and withdrawals count
    const pendingDeposits = await Deposit.countDocuments({ status: "pending" });
    const pendingWithdrawals = await Withdrawal.countDocuments({
      status: "pending",
    });

    // Get user levels distribution
    const userLevels = await User.aggregate([
      {
        $match: { role: "subscriber" },
      },
      {
        $group: {
          _id: "$level",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Format user levels
    const userLevelsObj = {
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0,
    };
    userLevels.forEach((level) => {
      userLevelsObj[`level${level._id}`] = level.count;
    });

    // Get top users by balance
    const topUsersByBalance = await Wallet.aggregate([
      {
        $sort: { balance: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "users",
          localField: "email",
          foreignField: "email",
          as: "user",
        },
      },
      {
        $unwind: "$user",
      },
      {
        $project: {
          email: 1,
          name: "$user.name",
          balance: 1,
          level: "$user.level",
        },
      },
    ]);

    // Get top users by referrals
    const topUsersByReferrals = await User.aggregate([
      {
        $match: {
          referrer: { $exists: true },
        },
      },
      {
        $group: {
          _id: "$referrer",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "referrer",
        },
      },
      {
        $unwind: "$referrer",
      },
      {
        $project: {
          email: "$referrer.email",
          name: "$referrer.name",
          referrals: "$count",
          earnings: "$referrer.affiliateEarnings",
        },
      },
    ]);

    // Get trend data for the past 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get month-over-month changes for financial metrics
    const lastMonth = new Date();
    lastMonth.setDate(lastMonth.getDate() - 60);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 90);

    // Previous month deposits
    const prevMonthDeposits = await Transaction.aggregate([
      {
        $match: {
          source: "deposit",
          status: "completed",
          type: "credit",
          createdAt: { $gte: lastMonth, $lt: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);

    // Previous month withdrawals
    const prevMonthWithdrawals = await Transaction.aggregate([
      {
        $match: {
          source: "withdrawal",
          status: "completed",
          type: "debit",
          createdAt: { $gte: lastMonth, $lt: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);

    // Previous month rewards
    const prevMonthRewards = await Transaction.aggregate([
      {
        $match: {
          $or: [
            { source: "task_reward" },
            { source: "referral" },
            { source: "bonus" },
          ],
          status: "completed",
          type: "credit",
          createdAt: { $gte: lastMonth, $lt: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
    ]);

    // Calculate percentage changes
    const currentMonthDeposits =
      totalDepositAmount.length > 0 ? totalDepositAmount[0].total : 0;
    const previousMonthDeposits =
      prevMonthDeposits.length > 0 ? prevMonthDeposits[0].total : 0;
    const depositChange =
      previousMonthDeposits === 0
        ? 100
        : Math.round(
            ((currentMonthDeposits - previousMonthDeposits) /
              previousMonthDeposits) *
              100
          );

    const currentMonthWithdrawals =
      totalWithdrawalAmount.length > 0 ? totalWithdrawalAmount[0].total : 0;
    const previousMonthWithdrawals =
      prevMonthWithdrawals.length > 0 ? prevMonthWithdrawals[0].total : 0;
    const withdrawalChange =
      previousMonthWithdrawals === 0
        ? 100
        : Math.round(
            ((currentMonthWithdrawals - previousMonthWithdrawals) /
              previousMonthWithdrawals) *
              100
          );

    const currentMonthRewards =
      totalRewardsAmount.length > 0 ? totalRewardsAmount[0].total : 0;
    const previousMonthRewards =
      prevMonthRewards.length > 0 ? prevMonthRewards[0].total : 0;
    const rewardChange =
      previousMonthRewards === 0
        ? 100
        : Math.round(
            ((currentMonthRewards - previousMonthRewards) /
              previousMonthRewards) *
              100
          );

    // Get user count change
    const prevMonthUsers = await User.countDocuments({
      createdAt: { $lt: thirtyDaysAgo, $gte: lastMonth },
    });

    const userChange =
      prevMonthUsers === 0
        ? 100
        : Math.round(((totalUsers - prevMonthUsers) / prevMonthUsers) * 100);

    // Prepare balance change percentage
    const platformBalance =
      totalWalletBalance.length > 0 ? totalWalletBalance[0].total : 0;
    const balanceChange = Math.round(
      ((platformBalance - previousMonthDeposits + previousMonthWithdrawals) /
        (previousMonthDeposits - previousMonthWithdrawals || 1)) *
        100
    );

    // Format data for response
    const analytics = {
      financial: {
        totalDeposits:
          totalDepositAmount.length > 0 ? totalDepositAmount[0].total : 0,
        totalWithdrawals:
          totalWithdrawalAmount.length > 0 ? totalWithdrawalAmount[0].total : 0,
        totalRewards:
          totalRewardsAmount.length > 0 ? totalRewardsAmount[0].total : 0,
        platformBalance,
        depositChange,
        withdrawalChange,
        rewardChange,
        balanceChange,
      },
      users: {
        totalUsers,
        userChange,
      },
      userLevels: userLevelsObj,
      topUsers: {
        byBalance: topUsersByBalance,
        byReferrals: topUsersByReferrals,
      },
      // Add the new fields for pending items
      pendingDeposits,
      pendingWithdrawals,
      pendingTasks,
      // Charts data remains unchanged
      charts: {
        // (chart data implementation)
      },
    };

    res.json(analytics);
  } catch (error) {
    console.error("ADMIN ANALYTICS ERROR:", error);
    res.status(500).json({
      error: "Error generating analytics",
      message: error.message,
    });
  }
};

// Search user by email
exports.searchUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user's wallet
    const wallet = await Wallet.findOne({ email });

    // Return user info with wallet
    return res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      level: user.level,
      wallet: wallet
        ? {
            balance: wallet.balance,
            currency: wallet.currency,
          }
        : null,
    });
  } catch (error) {
    console.error("SEARCH_USER_ERROR", error);
    return res.status(500).json({ error: "Error searching for user" });
  }
};
// Create manual deposit
// controllers/adminDeposit.js

exports.createManualDeposit = async (req, res) => {
  try {
    const { userId, planId, amount, adminNotes } = req.body;

    // Validate input
    if (!userId) return res.status(400).json({ error: "User ID is required" });
    if (!planId) return res.status(400).json({ error: "Plan ID is required" });
    if (!amount || amount <= 0)
      return res.status(400).json({ error: "Valid amount is required" });

    // Find user
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Find plan
    const plan = await InvestmentPlan.findById(planId);
    if (!plan)
      return res.status(404).json({ error: "Investment plan not found" });

    // Find or create wallet
    let wallet = await Wallet.findOne({ email: user.email });
    if (!wallet) {
      wallet = new Wallet({
        email: user.email,
        balance: 0,
        currency: "USD",
      });
    }

    // Create a placeholder screenshot URL for manual deposits
    const placeholderScreenshotUrl =
      "https://via.placeholder.com/300x200.png?text=Manual+Deposit+By+Admin";

    // Create deposit record
    const deposit = new Deposit({
      user: userId,
      amount,
      currency: "USD",
      status: "approved",
      paymentMethod: "admin",
      adminNotes: adminNotes || "Manual deposit by admin",
      approvedBy: req.user._id,
      assignedPlan: planId,
      approvedAt: new Date(),
      screenshotUrl: placeholderScreenshotUrl, // Add the required screenshotUrl field
    });

    await deposit.save();

    // Add amount to wallet
    wallet.balance += parseFloat(amount);
    wallet.lastUpdated = new Date();
    await wallet.save();

    // Create transaction record
    const transaction = new Transaction({
      email: user.email,
      walletId: wallet._id,
      amount,
      type: "credit",
      status: "completed",
      source: "deposit",
      description: `Manual deposit by admin ${
        adminNotes ? `- ${adminNotes}` : ""
      }`,
      reference: deposit._id.toString(),
    });

    await transaction.save();

    // Update user level based on plan
    if (plan.minLevel && plan.minLevel !== user.level) {
      user.level = plan.minLevel;
      await user.save();
    }

    res.status(201).json({
      success: true,
      message: "Manual deposit created successfully",
      deposit: {
        _id: deposit._id,
        amount,
        status: "approved",
      },
    });
  } catch (error) {
    console.error("CREATE_MANUAL_DEPOSIT_ERROR", error);
    return res.status(500).json({ error: "Error creating manual deposit" });
  }
};
