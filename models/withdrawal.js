// server/models/withdrawal.js
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Schema;

const withdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    currency: {
      type: String,
      default: "USD",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["bitcoin", "ethereum", "litecoin", "bank_transfer"],
      required: true,
    },
    walletAddress: {
      type: String,
      // Required for crypto withdrawals
    },
    bankDetails: {
      type: String,
      // Required for bank transfers
    },
    adminNotes: {
      type: String,
    },
    processedBy: {
      type: ObjectId,
      ref: "User",
    },
    processedAt: {
      type: Date,
    },
    transactionId: {
      type: String,
      // For tracking the transaction ID after processing
    },
  },
  { timestamps: true }
);

// Pre-save validation for required fields based on payment method
withdrawalSchema.pre("save", function (next) {
  // For crypto withdrawals, wallet address is required
  if (
    ["bitcoin", "ethereum", "litecoin"].includes(this.paymentMethod) &&
    !this.walletAddress
  ) {
    return next(
      new Error(
        `Wallet address is required for ${this.paymentMethod} withdrawals`
      )
    );
  }

  // For bank transfers, bank details are required
  if (this.paymentMethod === "bank_transfer" && !this.bankDetails) {
    return next(
      new Error("Bank details are required for bank transfer withdrawals")
    );
  }

  next();
});

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
