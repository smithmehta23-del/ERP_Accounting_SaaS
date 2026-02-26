const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authMiddleware = require("../middleware/authMiddleware");


// Register
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  const hashed = await bcrypt.hash(password, 10);

  const newUser = new User({
    name,
    email,
    password: hashed
  });

  await newUser.save();
  res.json({ msg: "User registered. Waiting for admin approval." });
});


// Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ msg: "User not found" });

  if (user.status !== "approved")
    return res.status(403).json({ msg: "Waiting for admin approval" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ msg: "Wrong password" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({ token, role: user.role });
});


// Get Pending Users (Admin Only)
router.get("/pending", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ msg: "Access denied" });

  const users = await User.find({ status: "pending" });
  res.json(users);
});


// Approve User (Admin Only)
router.put("/approve/:id", authMiddleware, async (req, res) => {
  if (req.user.role !== "admin")
    return res.status(403).json({ msg: "Access denied" });

  await User.findByIdAndUpdate(req.params.id, { status: "approved" });
  res.json({ msg: "User approved" });
});


// Dashboard Data
router.get("/dashboard", authMiddleware, (req, res) => {
  res.json({
    message: "Welcome to dashboard",
    role: req.user.role,
    liveUsers: 150,
    activeSessions: 23
  });
});

module.exports = router;
