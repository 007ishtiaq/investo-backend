// server/models/transaction.js
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      index: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wallet",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    source: {
      type: String,
      enum: [
        "task_reward",
        "deposit",
        "withdrawal",
        "referral",
        "bonus",
        "other",
      ],
      default: "other",
    },
    description: {
      type: String,
      required: true,
    },
    metadata: {
      taskId: mongoose.Schema.Types.ObjectId,
      // Other metadata can be added as needed
    },
    reference: {
      type: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);
