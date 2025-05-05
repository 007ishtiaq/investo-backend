// server/controllers/deposit.js
const Deposit = require("../models/deposit");
const User = require("../models/user");
const Investment = require("../models/investment");
const InvestmentPlan = require("../models/investmentPlan");
const Wallet = require("../models/wallet");
const Transaction = require("../models/transaction");
const {
  transporter,
  depositNotificationTemplate,
  depositRejectionTemplate,
} = require("../middlewares/utils");

// Create a new deposit request
exports.createDeposit = async (req, res) => {
  try {
    const { amount, paymentMethod, transactionId, screenshotUrl } = req.body;

    if (!amount || !paymentMethod || !screenshotUrl) {
      return res.status(400).json({
        error: "Amount, payment method, and screenshot are required",
      });
    }

    const user = await User.findOne({ email: req.user.email });

    const newDeposit = await new Deposit({
      user: user._id,
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
    const user = await User.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const deposits = await Deposit.find({ user: user._id })
      .sort({ createdAt: -1 })
      .populate("assignedPlan", "name durationInDays returnRate")
      .exec();

    if (deposits.length === 0) {
      return res.json({ message: "No deposits found", deposits: [] });
    }

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
      .populate("user", "email name")
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
    const { status, planId, adminNotes, amount } = req.body;

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

    // Get the admin user who is processing the deposit
    const adminUser = await User.findOne({ email: req.user.email });

    // Update deposit status
    deposit.status = status;
    deposit.adminNotes = adminNotes;
    deposit.approvedBy = adminUser._id;
    deposit.approvedAt = new Date();

    // Update the amount if provided in the request
    if (amount && !isNaN(amount) && amount > 0) {
      deposit.amount = amount;
    }

    // Get the depositor - we'll need this for both approved and rejected cases
    const depositor = await User.findById(deposit.user);

    if (!depositor) {
      return res.status(404).json({ error: "Depositor user not found" });
    }

    // Handle approval flow
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

      // Set user level to exactly match the plan's minLevel
      if (plan.minLevel && depositor.level !== plan.minLevel) {
        depositor.level = plan.minLevel;
        await depositor.save();
      }

      // Find or create wallet for the depositor
      let wallet = await Wallet.findOne({ email: depositor.email });

      if (!wallet) {
        // Create wallet if it doesn't exist
        wallet = await new Wallet({
          email: depositor.email,
          balance: 0,
        }).save();
      }

      // Update wallet balance
      wallet.balance += deposit.amount;
      wallet.lastUpdated = new Date();
      await wallet.save();

      // Record transaction for approved deposit - use valid enum values
      await new Transaction({
        email: depositor.email,
        walletId: wallet._id,
        amount: deposit.amount,
        type: "credit", // Valid enum value
        status: "completed", // Valid enum value
        source: "deposit",
        reference: deposit._id.toString(),
        description: `Deposit approved for investment in ${plan.name}`,
        metadata: {
          planId: plan._id,
          planName: plan.name,
        },
      }).save();

      // Send email notification for approved deposit if user has deposits notifications enabled
      try {
        // Check if user has deposit notifications enabled
        const notificationsEnabled =
          depositor.notifications && depositor.notifications.deposits !== false;

        if (notificationsEnabled) {
          // Import email template and transporter
          const {
            depositNotificationTemplate,
          } = require("../middlewares/utils");

          // Email content
          const mailOptions = {
            from: "Investo <ishtiaqahmad427427@gmail.com>",
            to: depositor.email,
            subject: "Deposit Approved - Investo",
            html: depositNotificationTemplate(deposit, plan),
          };

          // Send email using the transporter
          await transporter.sendMail(mailOptions);
          console.log("Deposit approval email sent to:", depositor.email);
        }
      } catch (emailError) {
        // Log the error but don't fail the entire process if email sending fails
        console.error("Failed to send deposit notification email:", emailError);
      }
    }
    // Handle rejection flow
    else if (status === "rejected") {
      // Find or create wallet for the depositor (for transaction record)
      let wallet = await Wallet.findOne({ email: depositor.email });

      if (!wallet) {
        // Create wallet if it doesn't exist
        wallet = await new Wallet({
          email: depositor.email,
          balance: 0,
        }).save();
      }

      // Record transaction for rejected deposit - use valid enum values
      await new Transaction({
        email: depositor.email,
        walletId: wallet._id,
        amount: deposit.amount,
        type: "debit", // Changed to a valid enum value
        status: "failed", // Valid enum value
        source: "deposit",
        reference: deposit._id.toString(),
        description: `Deposit request rejected${
          adminNotes ? `: ${adminNotes}` : ""
        }`,
        metadata: {
          reason: adminNotes || "No reason provided",
        },
      }).save();

      // Send email notification for rejected deposit if user has deposits notifications enabled
      try {
        // Check if user has deposit notifications enabled
        const notificationsEnabled =
          depositor.notifications && depositor.notifications.deposits !== false;

        if (notificationsEnabled) {
          // Import email template and transporter
          const { depositRejectionTemplate } = require("../middlewares/utils");

          // Email content
          const mailOptions = {
            from: "Investo <ishtiaqahmad427427@gmail.com>",
            to: depositor.email,
            subject: "Update on Your Deposit Request - Investo",
            html: depositRejectionTemplate(deposit, adminNotes),
          };

          // Send email using the transporter
          await transporter.sendMail(mailOptions);
          console.log("Deposit rejection email sent to:", depositor.email);
        }
      } catch (emailError) {
        // Log the error but don't fail the entire process if email sending fails
        console.error("Failed to send deposit rejection email:", emailError);
      }
    }

    await deposit.save();
    res.json(deposit);
  } catch (error) {
    console.error("Review deposit error:", error);
    res.status(500).json({ error: "Failed to process deposit request" });
  }
};
