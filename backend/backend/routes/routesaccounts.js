const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * Create Account
 */
router.post("/", (req, res) => {
  const { account_name, account_type } = req.body;

  const sql = `
    INSERT INTO accounts (account_name, account_type)
    VALUES (?, ?)
  `;

  db.query(sql, [account_name, account_type], (err, result) => {
    if (err) {
      return res.status(500).json(err);
    }
    res.json({ message: "Account created", id: result.insertId });
  });
});

/**
 * Get All Accounts
 */
router.get("/", (req, res) => {
  db.query("SELECT * FROM accounts", (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

module.exports = router;
