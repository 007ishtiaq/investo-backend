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
  getAdminAnalytics,
  searchUserByEmail,
  createManualDeposit,
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
// Analytics route
router.get("/admin/analytics", authCheck, adminCheck, getAdminAnalytics);

// Add these routes to your admin routes
router.get(
  "/admin/user/search/:email",
  authCheck,
  adminCheck,
  searchUserByEmail
);
router.post(
  "/admin/deposit/manual",
  authCheck,
  adminCheck,
  createManualDeposit
);

module.exports = router;
