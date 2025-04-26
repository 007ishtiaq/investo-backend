// server/controllers/wallet.js
const Wallet = require("../models/wallet");
const Transaction = require("../models/transaction");
const User = require("../models/user");
const mongoose = require("mongoose");

// Create wallet for a user if it doesn't exist
exports.createUserWallet = async (userId) => {
  try {
    // Check if wallet already exists
    const existingWallet = await Wallet.findOne({ userId });

    if (existingWallet) {
      return existingWallet;
    }

    // Create new wallet
    const wallet = new Wallet({
      userId,
      balance: 0,
      currency: "USD",
      isActive: true,
    });

    await wallet.save();
    return wallet;
  } catch (error) {
    console.error("Error creating wallet:", error);
    throw new Error("Failed to create wallet");
  }
};

// Get user wallet
exports.getUserWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find or create wallet
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await exports.createUserWallet(userId);
    }

    res.status(200).json(wallet);
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(500).json({ error: "Failed to fetch wallet" });
  }
};

// Credit amount to user wallet (internal function)
exports.creditToWallet = async (
  userId,
  amount,
  source,
  description,
  metadata = {}
) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find or create wallet
    let wallet = await Wallet.findOne({ userId }).session(session);

    if (!wallet) {
      wallet = await exports.createUserWallet(userId);
    }

    // Update wallet balance
    wallet.balance += amount;
    wallet.lastUpdated = Date.now();
    await wallet.save({ session });

    // Create transaction record
    const transaction = new Transaction({
      userId,
      walletId: wallet._id,
      amount,
      type: "credit",
      status: "completed",
      source,
      description,
      metadata,
      reference: `${source}-${Date.now()}`,
    });

    await transaction.save({ session });

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    return { success: true, wallet, transaction };
  } catch (error) {
    // Abort transaction
    await session.abortTransaction();
    session.endSession();

    console.error("Error crediting to wallet:", error);
    throw new Error("Failed to credit to wallet");
  }
};

// Get user transaction history
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments({ userId });

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
