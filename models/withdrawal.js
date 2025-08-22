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
      min: 1,
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
      enum: [
        "USDT (TRC20 - Tron)",
        "USDT (BEP20 - BNB Smart Chain)",
        "USDT (ERC20 - Ethereum)",
      ],
      required: true,
    },
    walletAddress: {
      type: String,
      trim: true,
    },
    adminNotes: {
      type: String,
    },
    processedBy: {
      type: ObjectId,
      ref: "User",
    },
    transactionId: {
      type: String,
      // For tracking the transaction ID after processing
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
