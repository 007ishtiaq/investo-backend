// server/routes/wallet.js
const express = require("express");
const router = express.Router();
const { authCheck } = require("../middlewares/auth");
const {
  getUserWallet,
  getTransactionHistory,
} = require("../controllers/wallet");

// Get user wallet
router.get("/wallet/user-wallet", authCheck, getUserWallet);

// Get transaction history
router.get("/wallet/transactions", authCheck, getTransactionHistory);

module.exports = router;
