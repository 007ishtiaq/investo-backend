// server/routes/team.js
const express = require("express");
const router = express.Router();
const { authCheck } = require("../middlewares/auth");
const {
  getTeamMembers,
  getAffiliateCode,
  registerWithAffiliateCode,
  creditReferralBonus,
  getTeamEarnings,
} = require("../controllers/team");

// Team routes
router.get("/team/members", authCheck, getTeamMembers);
router.get("/team/affiliate-code", authCheck, getAffiliateCode);
router.post("/team/register-affiliate", registerWithAffiliateCode);
router.post("/team/credit-bonus", authCheck, creditReferralBonus);

module.exports = router;
