// server/routes/admin.js
const express = require("express");
const router = express.Router();

// Middleware
const { authCheck, adminCheck } = require("../middlewares/auth");

// Controllers
const {
  getWithdrawals,
  getWithdrawalById,
  reviewWithdrawal,
} = require("../controllers/admin");

// Withdrawal routes
router.get("/admin/withdrawals", authCheck, adminCheck, getWithdrawals);
router.get("/admin/withdrawal/:id", authCheck, adminCheck, getWithdrawalById);
router.put(
  "/admin/withdrawal/:id/review",
  authCheck,
  adminCheck,
  reviewWithdrawal
);

module.exports = router;
