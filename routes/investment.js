// server/routes/investment.js
const express = require("express");
const router = express.Router();
const { authCheck, adminCheck } = require("../middlewares/auth");
const {
  getAllInvestments,
  distributeDailyProfits,
  getUserInvestments,
  getMyInvestments,
} = require("../controllers/investment");

// Admin routes
router.get("/admin/investments", authCheck, adminCheck, getAllInvestments);
router.post(
  "/admin/investments/distribute-profits",
  authCheck,
  adminCheck,
  distributeDailyProfits
);

// Route for getting investments by user ID (admin only)
router.get(
  "/investments/user/:userId",
  authCheck,
  adminCheck,
  getUserInvestments
);
// Route for getting current user's investments
router.get("/investments/my-investments", authCheck, getMyInvestments);

module.exports = router;
