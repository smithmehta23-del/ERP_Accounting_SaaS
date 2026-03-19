const express = require("express");
const protect = require("../middleware/authMiddleware");
const checkPlan = require("../middleware/planMiddleware");

const router = express.Router();

router.get("/profile", protect, (req, res) => {
  res.json({
    message: "Profile accessed",
    user: req.user
  });
});

router.get("/pro-feature", protect, checkPlan("pro"), (req, res) => {
  res.json({ message: "Welcome to Pro Feature" });
});

module.exports = router;