// server/routes/investment.js
const express = require("express");
const router = express.Router();
const { authCheck, adminCheck } = require("../middlewares/auth");
const {
  getAllInvestments,
  distributeDailyProfits,
} = require("../controllers/investment");

// Admin routes
router.get("/admin/investments", authCheck, adminCheck, getAllInvestments);
router.post(
  "/admin/investments/distribute-profits",
  authCheck,
  adminCheck,
  distributeDailyProfits
);

module.exports = router;
