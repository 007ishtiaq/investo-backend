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
