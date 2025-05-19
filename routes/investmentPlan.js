// server/routes/investmentPlan.js
const express = require("express");
const router = express.Router();
const { authCheck, adminCheck } = require("../middlewares/auth");
const {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
} = require("../controllers/investmentPlan");

// Public routes
router.get("/investment-plans", getAllPlans);
router.get("/investment-plans/:planId", getPlanById);

// Admin routes
router.post("/admin/investment-plans", authCheck, adminCheck, createPlan);
router.put(
  "/admin/investment-plans/:planId",
  authCheck,
  adminCheck,
  updatePlan
);
router.delete(
  "/admin/investment-plans/:planId",
  authCheck,
  adminCheck,
  deletePlan
);

module.exports = router;
