// server/controllers/wallet.js
const Wallet = require("../models/wallet");
const Transaction = require("../models/transaction");
const User = require("../models/user");
const Withdrawal = require("../models/withdrawal");
const {
  transporter,
  withdrawalNotificationTemplate,
  withdrawalRejectionTemplate,
} = require("../middlewares/utils");

// Create wallet for a user if it doesn't exist
exports.createUserWallet = async (email) => {
  try {
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
      level: user ? user.level || 0 : 0, // Default to level 1 if not found
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
    const filter = req.query.filter || "all";
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    // Build the query object
    let query = { email };

    // Apply filters
    if (filter !== "all") {
      switch (filter) {
        case "deposit":
          query.source = "deposit";
          break;
        case "withdraw":
          query.type = "debit";
          break;
        case "earning":
          query.source = { $in: ["task_reward", "referral", "bonus"] };
          break;
        case "pending":
          query.status = "pending";
          break;
        case "rejected":
          query.status = { $in: ["failed", "rejected"] };
          break;
        case "rejected_deposit":
          query.source = "deposit";
          query.status = { $in: ["failed", "rejected"] };
          break;
        case "rejected_withdraw":
          query.source = "withdrawal";
          query.status = { $in: ["failed", "rejected"] };
          break;
      }
    }

    // Apply search filter
    if (search) {
      query.description = { $regex: search, $options: "i" };
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments(query);

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

    // Create a transaction record with pending status
    await new Transaction({
      email: user.email,
      walletId: wallet._id,
      amount: parseFloat(amount),
      type: "debit", // This will be a debit when approved
      status: "pending", // Start as pending until approved
      source: "withdrawal",
      reference: newWithdrawal._id.toString(),
      description: `Withdrawal request under verification - ${paymentMethod}`,
      metadata: {
        paymentMethod: paymentMethod,
        walletAddress: walletAddress || null,
        bankDetails: bankDetails || null,
      },
    }).save();

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
    const { status, adminNotes, transactionId } = req.body;

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

    // Find the pending transaction
    const pendingTransaction = await Transaction.findOne({
      reference: withdrawalId,
      source: "withdrawal",
      status: "pending",
    });

    // Update withdrawal status
    withdrawal.status = status;
    withdrawal.adminNotes = adminNotes;
    withdrawal.processedBy = adminUser._id;
    withdrawal.processedAt = new Date();

    // Add transaction ID if provided (for approved withdrawals)
    if (status === "approved" && transactionId) {
      withdrawal.transactionId = transactionId;
    }

    if (status === "approved") {
      // Check if user still has sufficient balance (in case they made other withdrawals)
      if (wallet.balance < withdrawal.amount) {
        return res.status(400).json({ error: "User has insufficient balance" });
      }

      // Update wallet balance
      wallet.balance -= withdrawal.amount;
      wallet.lastUpdated = new Date();
      await wallet.save();

      // Update transaction status and details
      if (pendingTransaction) {
        pendingTransaction.status = "completed";
        pendingTransaction.description = `Withdrawal completed to ${withdrawal.paymentMethod}`;

        // Update metadata with transaction ID if provided
        if (transactionId) {
          pendingTransaction.metadata = {
            ...pendingTransaction.metadata,
            transactionId: transactionId,
          };
        }

        await pendingTransaction.save();
      }

      // Send email notification if user has withdrawals notifications enabled
      try {
        // Check if user has withdrawal notifications enabled
        const notificationsEnabled =
          withdrawalUser.notifications &&
          withdrawalUser.notifications.deposits === true;

        if (notificationsEnabled) {
          // Email content
          const mailOptions = {
            from: "Investo <ishtiaqahmad427427@gmail.com>",
            to: withdrawalUser.email,
            subject: "Withdrawal Approved - Investo",
            html: withdrawalNotificationTemplate(withdrawal),
          };
          // Send email using the transporter
          await transporter.sendMail(mailOptions);
        }
      } catch (emailError) {
        // Log the error but don't fail the entire process if email sending fails
        console.error("Failed to send withdrawal approval email:", emailError);
      }
    } else if (status === "rejected") {
      // Update transaction status and details
      if (pendingTransaction) {
        pendingTransaction.status = "failed";
        pendingTransaction.description = `Withdrawal request rejected${
          adminNotes ? `: ${adminNotes}` : ""
        }`;

        // Update metadata with rejection reason
        pendingTransaction.metadata = {
          ...pendingTransaction.metadata,
          reason: adminNotes || "No reason provided",
        };

        await pendingTransaction.save();
      }

      // Send email notification if user has withdrawals notifications enabled
      try {
        // Check if user has withdrawal notifications enabled
        const notificationsEnabled =
          withdrawalUser.notifications &&
          withdrawalUser.notifications.deposits === true;

        if (notificationsEnabled) {
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

// Send email to user when withdrawal is processed
// const sendWithdrawalProcessedEmail = async (withdrawal, user) => {
//   try {
//     // Check if user has email notifications enabled
//     if (!user.notifications || !user.notifications.deposits) {
//       console.log(`User ${user.email} has disabled deposit notifications`);
//       return; // Don't send email if user has disabled notifications
//     }

//     // Get the appropriate email template
//     let emailHtml;
//     let subject;

//     if (withdrawal.status === "approved") {
//       subject = "Your Withdrawal Has Been Approved";
//       emailHtml = withdrawalApprovalTemplate(withdrawal);
//     } else if (withdrawal.status === "rejected") {
//       subject = "Update on Your Withdrawal Request";
//       emailHtml = withdrawalRejectionTemplate(
//         withdrawal,
//         withdrawal.adminNotes
//       );
//     } else {
//       // If status is not approved or rejected, don't send an email
//       return;
//     }

//     // Use Mailjet to send the email
//     const mailjet = require("node-mailjet").connect(
//       process.env.MAILJET_API_KEY,
//       process.env.MAILJET_SECRET_KEY
//     );

//     const request = mailjet.post("send", { version: "v3.1" }).request({
//       Messages: [
//         {
//           From: {
//             Email: process.env.EMAIL_FROM,
//             Name: "Investo",
//           },
//           To: [
//             {
//               Email: user.email,
//               Name: user.name || user.email,
//             },
//           ],
//           Subject: subject,
//           HTMLPart: emailHtml,
//         },
//       ],
//     });

//     await request;
//     console.log(`Withdrawal ${withdrawal.status} email sent to ${user.email}`);
//     return true;
//   } catch (error) {
//     console.error("Error sending withdrawal processed email:", error);
//     return false;
//   }
// };

// // Review (approve or reject) a withdrawal
// exports.reviewWithdrawal = async (req, res) => {
//   try {
//     const { status, adminNotes, transactionId, planId } = req.body;
//     const withdrawalId = req.params.id;

//     // Validate the status
//     if (!["approved", "rejected"].includes(status)) {
//       return res.status(400).json({ error: "Invalid status" });
//     }

//     // Find the withdrawal
//     const withdrawal = await Withdrawal.findById(withdrawalId);
//     if (!withdrawal) {
//       return res.status(404).json({ error: "Withdrawal not found" });
//     }

//     // Check if withdrawal is already processed
//     if (withdrawal.status !== "pending") {
//       return res
//         .status(400)
//         .json({ error: "Withdrawal has already been processed" });
//     }

//     // For approved withdrawal, verify transaction ID
//     if (status === "approved" && !transactionId) {
//       return res
//         .status(400)
//         .json({ error: "Transaction ID is required for approved withdrawals" });
//     }

//     // Find the user and their wallet
//     const user = await User.findById(withdrawal.user);
//     if (!user) {
//       return res.status(404).json({ error: "User not found" });
//     }

//     const wallet = await Wallet.findOne({ email: user.email });
//     if (!wallet) {
//       return res.status(404).json({ error: "Wallet not found" });
//     }

//     // Find the pending transaction for this withdrawal
//     const pendingTransaction = await Transaction.findOne({
//       reference: withdrawal._id.toString(),
//       source: "withdrawal",
//       status: "pending",
//     });

//     if (status === "rejected") {
//       // Credit the wallet back
//       wallet.balance += withdrawal.amount;
//       wallet.lastUpdated = new Date();
//       await wallet.save();

//       // If we found a pending transaction, update its status to rejected
//       if (pendingTransaction) {
//         pendingTransaction.status = "failed";
//         pendingTransaction.description = "Withdrawal request rejected";
//         await pendingTransaction.save();
//       }

//       // Create a new credit transaction record for the returned funds
//       await Transaction.create({
//         email: user.email,
//         walletId: wallet._id,
//         amount: withdrawal.amount,
//         type: "credit",
//         status: "completed",
//         source: "withdrawal",
//         description: "Withdrawal request rejected, funds returned to wallet",
//         metadata: {
//           withdrawalId: withdrawal._id,
//         },
//       });
//     } else if (status === "approved") {
//       // Deduct from wallet balance if not already deducted
//       // First check if the wallet has sufficient balance
//       if (wallet.balance < withdrawal.amount) {
//         return res.status(400).json({
//           error: "Insufficient wallet balance to process this withdrawal",
//         });
//       }

//       // Deduct the amount from the wallet
//       wallet.balance -= withdrawal.amount;
//       wallet.lastUpdated = new Date();
//       await wallet.save();

//       // If we found a pending transaction, update its status to completed
//       if (pendingTransaction) {
//         pendingTransaction.status = "completed";
//         pendingTransaction.description = `Withdrawal via ${withdrawal.paymentMethod} completed`;
//         pendingTransaction.reference = `${withdrawal._id.toString()}-${transactionId}`;
//         await pendingTransaction.save();
//       } else {
//         // If no pending transaction found (unlikely, but as a fallback), create a completed one
//         await Transaction.create({
//           email: user.email,
//           walletId: wallet._id,
//           amount: withdrawal.amount,
//           type: "debit",
//           status: "completed",
//           source: "withdrawal",
//           description: `Withdrawal via ${withdrawal.paymentMethod} completed`,
//           reference: `${withdrawal._id.toString()}-${transactionId}`,
//           metadata: {
//             withdrawalId: withdrawal._id,
//           },
//         });
//       }

//       // If an investment plan was selected, update the user's level
//       if (planId) {
//         const plan = await InvestmentPlan.findById(planId);
//         if (plan && plan.minLevel) {
//           user.level = plan.minLevel;
//           await user.save();
//         }
//       }
//     }

//     // Update the withdrawal
//     withdrawal.status = status;
//     withdrawal.adminNotes = adminNotes;
//     withdrawal.processedBy = req.user._id;
//     withdrawal.processedAt = new Date();

//     if (status === "approved") {
//       withdrawal.transactionId = transactionId;
//     }

//     // If a plan was selected, record it
//     if (planId) {
//       withdrawal.assignedPlan = planId;
//     }

//     await withdrawal.save();

//     // Send email notification to user after withdrawal is processed
//     try {
//       await sendWithdrawalProcessedEmail(withdrawal, user);
//     } catch (emailError) {
//       console.error("EMAIL SENDING ERROR:", emailError);
//       // Don't fail the API response if email fails
//     }

//     res.json({ success: true, message: `Withdrawal ${status} successfully` });
//   } catch (error) {
//     console.error("REVIEW WITHDRAWAL ERROR:", error);
//     res.status(500).json({ error: "Error processing withdrawal" });
//   }
// };
