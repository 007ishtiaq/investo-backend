const express = require("express");
const router = express.Router();
const { sendContactMessage } = require("../controllers/contact");
const { authCheck } = require("../middlewares/auth");

// POST route for contact form submission (no multer middleware)
router.post("/contact", authCheck, sendContactMessage);

module.exports = router;
