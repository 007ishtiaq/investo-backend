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
const Contact = require("../models/contact");
const { processAffiliateRewards } = require("../functions/affiliateRewards");

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
    const { status, page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    let query = {};
    // Apply status filter if provided
    if (status && status !== "all") {
      query.status = status;
    }

    // Count total documents for pagination
    const total = await Withdrawal.countDocuments(query);

    // If status is 'pending', don't apply pagination to ensure all pending items are shown
    const withdrawalsQuery = Withdrawal.find(query)
      .populate("user", "email username level")
      .populate("processedBy", "email username")
      .sort({ createdAt: -1 });

    // Apply pagination only for 'all' status
    if (status !== "pending") {
      withdrawalsQuery.skip(skip).limit(limitNum);
    }

    const withdrawals = await withdrawalsQuery;

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

    // Return with pagination data for 'all' status
    if (status !== "pending") {
      res.json({
        withdrawals: withdrawalsWithWalletInfo,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
        },
      });
    } else {
      // For pending, just return the withdrawals
      res.json(withdrawalsWithWalletInfo);
    }
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

    // Get new contact messages count
    const newContactMessages = await Contact.countDocuments({ status: "new" });

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

    // Generate date labels for the past 30 days
    const dateLabels = [];
    const daysData = [];
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // Format date as MM/DD
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const formattedDate = `${month}/${day}`;

      dateLabels.push(formattedDate);
      daysData.push(date);
    }

    // Get daily deposits for the past 30 days
    const depositsByDay = await Transaction.aggregate([
      {
        $match: {
          source: "deposit",
          status: "completed",
          type: "credit",
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%m/%d", date: "$createdAt" },
          },
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get daily withdrawals for the past 30 days
    const withdrawalsByDay = await Transaction.aggregate([
      {
        $match: {
          source: "withdrawal",
          status: "completed",
          type: "debit",
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%m/%d", date: "$createdAt" },
          },
          total: { $sum: { $toDouble: "$amount" } },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Get daily user signups for the past 30 days
    const userGrowthByDay = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%m/%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Create lookup maps for faster access
    const depositMap = {};
    depositsByDay.forEach((item) => {
      depositMap[item._id] = item.total;
    });

    const withdrawalMap = {};
    withdrawalsByDay.forEach((item) => {
      withdrawalMap[item._id] = item.total;
    });

    const userGrowthMap = {};
    userGrowthByDay.forEach((item) => {
      userGrowthMap[item._id] = item.count;
    });

    // Prepare arrays for chart data
    const depositsData = [];
    const withdrawalsData = [];
    const userGrowthData = [];

    // Fill in the arrays with data from each day
    dateLabels.forEach((dateLabel) => {
      // Format dateLabel to match MongoDB format
      let parts = dateLabel.split("/");
      let formattedLabel =
        parts[0].padStart(2, "0") + "/" + parts[1].padStart(2, "0");

      // Use lookup maps to get values
      depositsData.push(depositMap[formattedLabel] || 0);
      withdrawalsData.push(withdrawalMap[formattedLabel] || 0);
      userGrowthData.push(userGrowthMap[formattedLabel] || 0);
    });

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
      newContactMessages,
      // Add chart data
      charts: {
        dateLabels: dateLabels,
        financialTrend: {
          deposits: depositsData,
          withdrawals: withdrawalsData,
        },
        userGrowth: userGrowthData,
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

// Get all contact messages
exports.getAllContactMessages = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Count total documents for pagination
    const total = await Contact.countDocuments({});

    // Get paginated contacts
    const contacts = await Contact.find({})
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limitNum)
      .exec();

    res.json({
      contacts,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Get contacts error:", error);
    res.status(500).json({ error: "Error fetching contact messages" });
  }
};
// Get single contact message
exports.getSingleContactMessage = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id).exec();

    if (!contact) {
      return res.status(404).json({ error: "Contact message not found" });
    }

    res.json(contact);
  } catch (error) {
    console.error("Get contact error:", error);
    res.status(500).json({ error: "Error fetching contact message" });
  }
};
// Update contact message status
exports.updateContactStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).exec();

    if (!contact) {
      return res.status(404).json({ error: "Contact message not found" });
    }

    res.json(contact);
  } catch (error) {
    console.error("Update contact status error:", error);
    res.status(500).json({ error: "Error updating contact status" });
  }
};
// Add note to contact message
exports.addContactNote = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Note text is required" });
    }

    const admin = await User.findOne({ email: req.user.email }).exec();

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          notes: {
            text,
            createdBy: admin.name || admin.email,
          },
        },
      },
      { new: true }
    ).exec();

    if (!contact) {
      return res.status(404).json({ error: "Contact message not found" });
    }

    res.json(contact);
  } catch (error) {
    console.error("Add contact note error:", error);
    res.status(500).json({ error: "Error adding note to contact" });
  }
};

exports.triggerAffiliateRewards = async (req, res) => {
  try {
    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Unauthorized access" });
    }

    const result = await processAffiliateRewards();

    res.json({
      success: true,
      message: "Affiliate rewards processed successfully",
      data: result,
    });
  } catch (error) {
    console.error("Failed to process affiliate rewards:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process affiliate rewards",
    });
  }
};
