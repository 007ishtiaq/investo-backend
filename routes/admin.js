// server/routes/admin.js
const express = require("express");
const router = express.Router();

// Middleware
const { authCheck, adminCheck } = require("../middlewares/auth");

// Controllers
const {
  getWithdrawals,
  getWithdrawalById,
  getAdminAnalytics,
  searchUserByEmail,
  createManualDeposit,
  getAllContactMessages,
  getSingleContactMessage,
  updateContactStatus,
  addContactNote,
} = require("../controllers/admin");

// Withdrawal routes
router.get("/admin/withdrawals", authCheck, adminCheck, getWithdrawals);
router.get("/admin/withdrawal/:id", authCheck, adminCheck, getWithdrawalById);

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

// Contact management routes
router.get("/admin/contacts", authCheck, adminCheck, getAllContactMessages);
router.get(
  "/admin/contact/:id",
  authCheck,
  adminCheck,
  getSingleContactMessage
);
router.put(
  "/admin/contact/:id/status",
  authCheck,
  adminCheck,
  updateContactStatus
);
router.post("/admin/contact/:id/note", authCheck, adminCheck, addContactNote);

module.exports = router;
