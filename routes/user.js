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
} = require("../controllers/user");

// User management
router.get("/admin/users", authCheck, adminCheck, getUsers);
router.get("/user/level", authCheck, getUserLevel);
router.put("/admin/user/:userId/level", authCheck, adminCheck, updateUserLevel);
router.get("/current-user", authCheck, getCurrentUser);
router.put("/user/profile", authCheck, updateProfile);
router.put("/user/notifications", authCheck, updateNotificationPreferences);

module.exports = router;
