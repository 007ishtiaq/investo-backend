// server/routes/user.js (additions for level management)
const express = require("express");
const router = express.Router();
const { authCheck, adminCheck } = require("../middlewares/auth");
const {
  getUsers,
  updateUserLevel,
  getUserLevel,
  updateProfile,
  getCurrentUser,
  updateNotificationPreferences,
  getTotalDeposits,
  getTotalWithdrawals,
  getTeamEarnings,
  getTotalEarnings,
  upgradePlan,
  getAffiliateRewards,
  getUserInvestments,
} = require("../controllers/user");

// User management
router.get("/admin/users", authCheck, adminCheck, getUsers);
router.get("/user/level", authCheck, getUserLevel);
router.get("/user/investments", authCheck, getUserInvestments);
router.put("/admin/user/:userId/level", authCheck, adminCheck, updateUserLevel);
router.get("/current-user", authCheck, getCurrentUser);
router.put("/user/profile", authCheck, updateProfile);
router.put("/user/notifications", authCheck, updateNotificationPreferences);

// Get total deposits
router.get("/wallet/total-deposits", authCheck, getTotalDeposits);
// Get total withdrawals
router.get("/wallet/total-withdrawals", authCheck, getTotalWithdrawals);
// Get team earnings
router.get("/wallet/team-earnings", authCheck, getTeamEarnings);
// Get total earnings (all sources)
router.get("/wallet/total-earnings", authCheck, getTotalEarnings);

router.post("/user/upgrade-plan", authCheck, upgradePlan);

router.get("/affiliate-rewards", authCheck, getAffiliateRewards);

module.exports = router;
