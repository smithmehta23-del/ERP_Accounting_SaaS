const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * GET /api/accounts
 * Retrieve list of all accounts
 */
router.get("/", (req, res) => {
  db.query("SELECT * FROM accounts ORDER BY id ASC", (err, results) => {
    if (err) {
      console.error("Error fetching accounts:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

/**
 * GET /api/accounts/:id
 * Retrieve a single account by id
 */
router.get("/:id", (req, res) => {
  const { id } = req.params;
  db.query("SELECT * FROM accounts WHERE id = ?", [id], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json(results[0]);
  });
});

/**
 * POST /api/accounts
 * Create new account
 */
router.post("/", (req, res) => {
  const { account_name, account_type, balance } = req.body;

  if (!account_name || !account_type) {
    return res.status(400).json({
      error: "account_name and account_type are required"
    });
  }

  const sql =
    "INSERT INTO accounts (account_name, account_type, balance) VALUES (?, ?, ?)";

  db.query(
    sql,
    [account_name, account_type, balance || 0],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to create account" });
      }

      res.json({
        message: "Account created successfully ✅",
        account_id: result.insertId
      });
    }
  );
});

/**
 * PUT /api/accounts/:id
 * Update an existing account
 */
router.put("/:id", (req, res) => {
  const { id } = req.params;
  const { account_name, account_type, balance } = req.body;

  if (!account_name && !account_type && balance === undefined) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  const fields = [];
  const values = [];
  if (account_name) {
    fields.push("account_name = ?");
    values.push(account_name);
  }
  if (account_type) {
    fields.push("account_type = ?");
    values.push(account_type);
  }
  if (balance !== undefined) {
    fields.push("balance = ?");
    values.push(balance);
  }
  values.push(id);

  const sql = `UPDATE accounts SET ${fields.join(", ")} WHERE id = ?`;
  db.query(sql, values, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to update account" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json({ message: "Account updated successfully ✅" });
  });
});

/**
 * DELETE /api/accounts/:id
 * Remove an account
 */
router.delete("/:id", (req, res) => {
  const { id } = req.params;
  db.query("DELETE FROM accounts WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to delete account" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Account not found" });
    }
    res.json({ message: "Account deleted successfully ✅" });
  });
});

module.exports = router;
