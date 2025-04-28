// server/routes/task.js
const express = require("express");
const router = express.Router();
const {
  createTask,
  getAllTasks,
  getTask,
  updateTask,
  deleteTask,
  startTask,
  verifyTask,
  getUserTasks,
  getTaskEarnings,
  getAllTasksAdmin,
  getTaskCompletionStats,
  getPendingVerificationTasks,
} = require("../controllers/task");
const { approveTask, rejectTask } = require("../controllers/admin");
const { authCheck, adminCheck } = require("../middlewares/auth");

// Public routes
router.get("/tasks", authCheck, getAllTasks);
router.get("/tasks/:id", getTask);

// User routes (require authentication)
router.post("/tasks/:id/start", authCheck, startTask);
router.post("/tasks/:taskId/verify", authCheck, verifyTask);
router.get("/user/tasks", authCheck, getUserTasks);
router.get("/user/tasks/earnings", authCheck, getTaskEarnings);

// Admin routes (require admin privileges)
router.post("/admin/tasks", authCheck, adminCheck, createTask);
router.put("/admin/tasks/:taskId", authCheck, adminCheck, updateTask);
router.delete("/admin/tasks/:id", authCheck, adminCheck, deleteTask);
router.get("/admin/tasks", authCheck, adminCheck, getAllTasksAdmin);
router.get(
  "/admin/tasks/completions",
  authCheck,
  adminCheck,
  getTaskCompletionStats
);

router.get(
  "/admin/tasks/pending",
  authCheck,
  adminCheck,
  getPendingVerificationTasks
);
// Approve a task
router.post(
  "/admin/tasks/:userTaskId/approve",
  authCheck,
  adminCheck,
  approveTask
);
// Reject a task
router.post(
  "/admin/tasks/:userTaskId/reject",
  authCheck,
  adminCheck,
  rejectTask
);

module.exports = router;
