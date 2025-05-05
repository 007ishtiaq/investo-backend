// server/routes/wallet.js
const express = require("express");
const router = express.Router();
const { authCheck } = require("../middlewares/auth");
const {
  getUserWallet,
  getTransactionHistory,
  withdraw,
  getWithdrawals,
  reviewWithdrawal,
} = require("../controllers/wallet");

// Get user wallet
router.get("/wallet/user-wallet", authCheck, getUserWallet);
router.post("/wallet/withdraw", authCheck, withdraw);
router.get("/wallet/withdrawals", authCheck, getWithdrawals);

// Admin routes (for approving/rejecting withdrawals)
router.put(
  "/admin/withdrawal/:withdrawalId/review",
  authCheck,
  reviewWithdrawal
);

// Get transaction history
router.get("/wallet/transactions", authCheck, getTransactionHistory);

module.exports = router;
