// server/controllers/investmentPlan.js
const InvestmentPlan = require("../models/investmentPlan");

// Get all active investment plans
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await InvestmentPlan.find({ active: true })
      .sort({ minLevel: 1, minAmount: 1 })
      .exec();

    res.json(plans);
  } catch (error) {
    console.error("Get all plans error:", error);
    res.status(500).json({ error: "Failed to fetch investment plans" });
  }
};

// Get plans available for the user's level
exports.getPlansForUserLevel = async (req, res) => {
  try {
    const userLevel = req.user.level || 1;

    const plans = await InvestmentPlan.find({
      active: true,
      minLevel: { $lte: userLevel },
    })
      .sort({ minLevel: 1, minAmount: 1 })
      .exec();

    res.json(plans);
  } catch (error) {
    console.error("Get user plans error:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch available investment plans" });
  }
};

// Get a single plan by ID
exports.getPlanById = async (req, res) => {
  try {
    const plan = await InvestmentPlan.findById(req.params.planId);

    if (!plan) {
      return res.status(404).json({ error: "Investment plan not found" });
    }

    res.json(plan);
  } catch (error) {
    console.error("Get plan by ID error:", error);
    res.status(500).json({ error: "Failed to fetch investment plan" });
  }
};

// Admin: Create a new investment plan
exports.createPlan = async (req, res) => {
  try {
    const newPlan = await new InvestmentPlan(req.body).save();
    res.json(newPlan);
  } catch (error) {
    console.error("Create plan error:", error);
    res.status(400).json({ error: "Failed to create investment plan" });
  }
};

// Admin: Update an investment plan
exports.updatePlan = async (req, res) => {
  try {
    const updated = await InvestmentPlan.findByIdAndUpdate(
      req.params.planId,
      req.body,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "Investment plan not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Update plan error:", error);
    res.status(400).json({ error: "Failed to update investment plan" });
  }
};

// Admin: Delete an investment plan
exports.deletePlan = async (req, res) => {
  try {
    const deleted = await InvestmentPlan.findByIdAndDelete(req.params.planId);

    if (!deleted) {
      return res.status(404).json({ error: "Investment plan not found" });
    }

    res.json({ message: "Investment plan deleted successfully" });
  } catch (error) {
    console.error("Delete plan error:", error);
    res.status(400).json({ error: "Failed to delete investment plan" });
  }
};
