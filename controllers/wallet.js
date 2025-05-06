// server/controllers/wallet.js
const Wallet = require("../models/wallet");
const Transaction = require("../models/transaction");
const User = require("../models/user");
const Withdrawal = require("../models/withdrawal");

// Create wallet for a user if it doesn't exist
exports.createUserWallet = async (email) => {
  try {
    console.log("email got", email);

    if (!email) {
      throw new Error("Email is required to create a wallet");
    }

    // Check if wallet already exists
    const existingWallet = await Wallet.findOne({ email });

    if (existingWallet) {
      return existingWallet;
    }

    // Create new wallet
    const wallet = new Wallet({
      email,
      balance: 0,
      currency: "USD",
      isActive: true,
    });

    await wallet.save();
    console.log(`New wallet created for user ${email}`);
    return wallet;
  } catch (error) {
    console.error("Error creating wallet:", error);
    throw new Error(`Failed to create wallet: ${error.message}`);
  }
};

// Get user wallet
exports.getUserWallet = async (req, res) => {
  try {
    const { email } = req.user;

    if (!email) {
      return res
        .status(400)
        .json({ error: "Email not found in authentication" });
    }

    // Find or create wallet
    let wallet = await Wallet.findOne({ email });

    if (!wallet) {
      console.log(`No wallet found for user ${email}, creating a new one`);
      wallet = await exports.createUserWallet(email);
    }

    // Get user level from User model
    const user = await User.findOne({ email: email });

    // Prepare response with wallet and level
    const response = {
      ...wallet.toObject(),
      level: user ? user.level || 1 : 1, // Default to level 1 if not found
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(500).json({ error: `Failed to fetch wallet: ${error.message}` });
  }
};

// Credit amount to user wallet (internal function) - without transactions
exports.creditToWallet = async (
  email,
  amount,
  source,
  description,
  metadata = {}
) => {
  try {
    if (!email) {
      throw new Error("Email is required to credit wallet");
    }

    // console.log(`Crediting wallet for user email ${email}`);

    // Find or create wallet
    let wallet = await Wallet.findOne({ email });

    if (!wallet) {
      console.log(
        `Creating new wallet during credit operation for user ${email}`
      );
      wallet = await exports.createUserWallet(email);

      // Re-fetch to ensure we have the latest data
      wallet = await Wallet.findOne({ email });
      if (!wallet) {
        throw new Error("Failed to create wallet during credit operation");
      }
    }

    // Update wallet balance
    wallet.balance += amount;
    wallet.lastUpdated = Date.now();
    await wallet.save();

    // Create transaction record
    const transaction = new Transaction({
      email,
      walletId: wallet._id,
      amount,
      type: "credit",
      status: "completed",
      source,
      description,
      metadata,
      reference: `${source}-${Date.now()}`,
    });

    await transaction.save();

    console.log(`Successfully credited ${amount} to wallet for user ${email}`);
    return { success: true, wallet, transaction };
  } catch (error) {
    console.error("Error crediting to wallet:", error);
    throw new Error(`Failed to credit to wallet: ${error.message}`);
  }
};

// Get user transaction history
exports.getTransactionHistory = async (req, res) => {
  try {
    const { email } = req.user;

    if (!email) {
      return res
        .status(400)
        .json({ error: "Email not found in authentication" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ email })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments({ email });

    res.status(200).json({
      transactions,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
      },
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ error: "Failed to fetch transaction history" });
  }
};

// Submit withdrawal request
exports.withdraw = async (req, res) => {
  try {
    const { amount, paymentMethod, walletAddress, bankDetails } = req.body;
    console.log(
      "hitting withdraw",
      amount,
      paymentMethod,
      walletAddress,
      bankDetails
    );

    // Validate input
    if (!amount || !paymentMethod) {
      return res
        .status(400)
        .json({ error: "Amount and payment method are required" });
    }

    if (parseFloat(amount) <= 0) {
      return res
        .status(400)
        .json({ error: "Amount must be greater than zero" });
    }

    // Validate payment method specific details
    if (
      ["bitcoin", "ethereum", "litecoin"].includes(paymentMethod) &&
      !walletAddress
    ) {
      return res.status(400).json({
        error: `Wallet address is required for ${paymentMethod} withdrawals`,
      });
    }

    if (paymentMethod === "bank_transfer" && !bankDetails) {
      return res.status(400).json({
        error: "Bank details are required for bank transfer withdrawals",
      });
    }

    // Check if user has a wallet
    const wallet = await Wallet.findOne({ email: req.user.email });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Check if user has sufficient balance
    if (parseFloat(amount) > wallet.balance) {
      return res.status(400).json({ error: "Insufficient wallet balance" });
    }

    // Get user ID
    const user = await User.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Create withdrawal request
    const newWithdrawal = new Withdrawal({
      user: user._id,
      amount: parseFloat(amount),
      paymentMethod,
      walletAddress,
      bankDetails,
      status: "pending",
    });

    await newWithdrawal.save();

    res.json({
      success: true,
      message: "Withdrawal request submitted successfully",
      withdrawal: newWithdrawal,
    });
  } catch (error) {
    console.error("WITHDRAWAL REQUEST ERROR", error);
    res.status(500).json({ error: "Error processing withdrawal request" });
  }
};
// Get user's withdrawal history
exports.getWithdrawals = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const withdrawals = await Withdrawal.find({ user: user._id }).sort({
      createdAt: -1,
    });

    res.json({ withdrawals });
  } catch (error) {
    console.error("GET WITHDRAWALS ERROR", error);
    res.status(500).json({ error: "Error fetching withdrawal history" });
  }
};
// Admin review withdrawal request (approve/reject)
exports.reviewWithdrawal = async (req, res) => {
  try {
    const { withdrawalId } = req.params;
    const { status, adminNotes } = req.body;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    // Find the withdrawal request
    const withdrawal = await Withdrawal.findById(withdrawalId);

    if (!withdrawal) {
      return res.status(404).json({ error: "Withdrawal request not found" });
    }

    if (withdrawal.status !== "pending") {
      return res
        .status(400)
        .json({ error: "Withdrawal request already processed" });
    }

    // Get the admin user
    const adminUser = await User.findOne({ email: req.user.email });

    // Get the user who requested the withdrawal
    const withdrawalUser = await User.findById(withdrawal.user);

    if (!withdrawalUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Find the wallet
    const wallet = await Wallet.findOne({ email: withdrawalUser.email });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Find the transaction
    const transaction = await Transaction.findOne({
      reference: withdrawalId,
      source: "withdrawal",
    });

    // Update withdrawal status
    withdrawal.status = status;
    withdrawal.adminNotes = adminNotes;
    withdrawal.processedBy = adminUser._id;
    withdrawal.processedAt = new Date();

    if (status === "approved") {
      // Check if user still has sufficient balance (in case they made other withdrawals)
      if (wallet.balance < withdrawal.amount) {
        return res.status(400).json({ error: "User has insufficient balance" });
      }

      // Update wallet balance
      wallet.balance -= withdrawal.amount;
      wallet.lastUpdated = new Date();
      await wallet.save();

      // Update transaction status
      if (transaction) {
        transaction.status = "completed";
        await transaction.save();
      }

      // Send email notification if user has deposits notifications enabled
      try {
        // Check if user has withdrawal notifications enabled
        const notificationsEnabled =
          withdrawalUser.notifications &&
          withdrawalUser.notifications.deposits !== false;

        if (notificationsEnabled) {
          // Import email template and transporter
          const {
            withdrawalApprovalTemplate,
          } = require("../middlewares/utils");

          // Email content
          const mailOptions = {
            from: "Investo <ishtiaqahmad427427@gmail.com>",
            to: withdrawalUser.email,
            subject: "Withdrawal Approved - Investo",
            html: withdrawalApprovalTemplate(withdrawal),
          };
          // Send email using the transporter
          await transporter.sendMail(mailOptions);
          console.log(
            "Withdrawal approval email sent to:",
            withdrawalUser.email
          );
        }
      } catch (emailError) {
        // Log the error but don't fail the entire process if email sending fails
        console.error("Failed to send withdrawal approval email:", emailError);
      }
    } else if (status === "rejected") {
      // Update transaction status
      if (transaction) {
        transaction.status = "failed";
        await transaction.save();
      }

      // Send email notification if user has deposits notifications enabled
      try {
        // Check if user has withdrawal notifications enabled
        const notificationsEnabled =
          withdrawalUser.notifications &&
          withdrawalUser.notifications.deposits !== false;

        if (notificationsEnabled) {
          // Import email template and transporter
          const {
            withdrawalRejectionTemplate,
          } = require("../middlewares/utils");

          // Email content
          const mailOptions = {
            from: "Investo <ishtiaqahmad427427@gmail.com>",
            to: withdrawalUser.email,
            subject: "Update on Your Withdrawal Request - Investo",
            html: withdrawalRejectionTemplate(withdrawal, adminNotes),
          };
          // Send email using the transporter
          await transporter.sendMail(mailOptions);
          console.log(
            "Withdrawal rejection email sent to:",
            withdrawalUser.email
          );
        }
      } catch (emailError) {
        // Log the error but don't fail the entire process if email sending fails
        console.error("Failed to send withdrawal rejection email:", emailError);
      }
    }

    await withdrawal.save();
    res.json(withdrawal);
  } catch (error) {
    console.error("REVIEW WITHDRAWAL ERROR", error);
    res.status(500).json({ error: "Error processing withdrawal review" });
  }
};
