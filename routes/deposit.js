// server/routes/deposit.js
const express = require("express");
const router = express.Router();
const { authCheck, adminCheck } = require("../middlewares/auth");
const {
  createDeposit,
  getUserDeposits,
  getAllDeposits,
  getPendingDeposits,
  reviewDeposit,
} = require("../controllers/deposit");

// User routes
router.post("/deposit/create", authCheck, createDeposit);
router.get("/user/deposits", authCheck, getUserDeposits);

// Admin routes
router.get("/admin/deposits", authCheck, adminCheck, getAllDeposits);
router.get(
  "/admin/deposits/pending",
  authCheck,
  adminCheck,
  getPendingDeposits
);
router.post(
  "/admin/deposit/:depositId/review",
  authCheck,
  adminCheck,
  reviewDeposit
);

module.exports = router;
