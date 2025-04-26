// server/controllers/wallet.js
const Wallet = require("../models/wallet");
const Transaction = require("../models/transaction");
const User = require("../models/user");

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

    console.log(`Getting wallet for user email: ${email}`);

    // Find or create wallet
    let wallet = await Wallet.findOne({ email });

    if (!wallet) {
      console.log(`No wallet found for user ${email}, creating a new one`);
      wallet = await exports.createUserWallet(email);
    }

    res.status(200).json(wallet);
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

    console.log(`Crediting wallet for user email ${email}`);

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
