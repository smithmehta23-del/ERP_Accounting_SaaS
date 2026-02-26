require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("./db");
const authMiddleware = require("./middleware/auth");
const adminMiddleware = require("./middleware/admin");
const accountsRoute = require("./routes/accounts");

const app = express();

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

/* =====================================================
   REGISTER (Create Company + Admin)
===================================================== */
app.post("/api/register", async (req, res) => {
  const { name, email, password, company_name } = req.body;

  if (!name || !email || !password || !company_name) {
    return res.status(400).json({ message: "All fields required" });
	  }

  const hashedPassword = await bcrypt.hash(password, 10);

  // Create company
  db.query(
    "INSERT INTO companies (company_name) VALUES (?)",
    [company_name],
    (err, companyResult) => {
      if (err) return res.status(500).json({ message: "Company creation failed" });

      const companyId = companyResult.insertId;

      // Create admin user
      db.query(
        "INSERT INTO users (name, email, password, role, approved, company_id) VALUES (?, ?, ?, 'admin', 1, ?)",
        [name, email, hashedPassword, companyId],
        (err) => {
          if (err) return res.status(500).json({ message: "User creation failed" });

          res.json({ message: "Company & Admin created successfully ✅" });
        }
      );
    }
  );
});

/* =====================================================
   LOGIN
===================================================== */
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0)
      return res.status(400).json({ message: "User not found" });

    const user = results[0];

    if (!user.approved)
      return res.status(403).json({ message: "Account not approved" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user.id, role: user.role, company_id: user.company_id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful ✅",
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  });
});

/* =====================================================
   ACCOUNTS ROUTE
===================================================== */
app.use("/api/accounts", authMiddleware, accountsRoute);

/* =====================================================
   CREATE VOUCHER
===================================================== */
app.post("/api/vouchers", authMiddleware, (req, res) => {
  const companyId = req.user.company_id;

  const {
    voucher_date,
    debit_account_id,
    credit_account_id,
    amount,
    narration,
  } = req.body;

  if (!voucher_date || !debit_account_id || !credit_account_id || !amount) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  db.query(
    `INSERT INTO vouchers
     (voucher_date, debit_account_id, credit_account_id, amount, narration, company_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [voucher_date, debit_account_id, credit_account_id, amount, narration, companyId],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Voucher insert failed" });

      res.json({
        message: "Voucher created successfully ✅",
        voucher_id: result.insertId,
      });
    }
  );
});

/* =====================================================
   GET VOUCHERS (Date Filter + Company Filter)
===================================================== */
app.get("/api/vouchers", authMiddleware, (req, res) => {
  const companyId = req.user.company_id;
  const { from, to } = req.query;

  let sql = "SELECT * FROM vouchers WHERE company_id = ?";
  const values = [companyId];

  if (from && to) {
    sql += " AND voucher_date BETWEEN ? AND ?";
    values.push(from, to);
  }

  sql += " ORDER BY voucher_date DESC";

  db.query(sql, values, (err, results) => {
    if (err) return res.status(500).json({ error: "Failed to fetch vouchers" });
    res.json(results);
  });
});

/* =====================================================
   LEDGER REPORT
===================================================== */
app.get("/api/ledger/:accountId", authMiddleware, (req, res) => {
  const companyId = req.user.company_id;
  const { accountId } = req.params;
  const { from, to } = req.query;

  let sql = `
    SELECT voucher_date, narration,
      CASE WHEN debit_account_id = ? THEN amount ELSE 0 END AS debit,
      CASE WHEN credit_account_id = ? THEN amount ELSE 0 END AS credit
    FROM vouchers
    WHERE company_id = ?
      AND (debit_account_id = ? OR credit_account_id = ?)
  `;

  const values = [accountId, accountId, companyId, accountId, accountId];

  if (from && to) {
    sql += " AND voucher_date BETWEEN ? AND ?";
    values.push(from, to);
  }

  sql += " ORDER BY voucher_date ASC";

  db.query(sql, values, (err, results) => {
    if (err) return res.status(500).json({ error: "Ledger failed" });
    res.json(results);
  });
});

/* =====================================================
   TRIAL BALANCE (Company Filtered)
===================================================== */
app.get("/api/trial-balance", authMiddleware, (req, res) => {
  const companyId = req.user.company_id;

  const sql = `
    SELECT 
      a.id,
      a.account_name,
      SUM(CASE WHEN v.debit_account_id = a.id THEN v.amount ELSE 0 END) AS debit,
      SUM(CASE WHEN v.credit_account_id = a.id THEN v.amount ELSE 0 END) AS credit
    FROM accounts a
    LEFT JOIN vouchers v 
      ON a.id IN (v.debit_account_id, v.credit_account_id)
      AND v.company_id = ?
    WHERE a.company_id = ?
    GROUP BY a.id
  `;

  db.query(sql, [companyId, companyId], (err, results) => {
    if (err) return res.status(500).json({ error: "Trial balance failed" });
    res.json(results);
  });
});

/* =====================================================
   BALANCE SHEET
===================================================== */
app.get("/api/balance-sheet", authMiddleware, (req, res) => {
  const companyId = req.user.company_id;

  const sql = `
    SELECT 
      a.account_name,
      a.account_type,
      SUM(
        CASE 
          WHEN v.debit_account_id = a.id THEN v.amount
          WHEN v.credit_account_id = a.id THEN -v.amount
          ELSE 0
        END
      ) AS balance
    FROM accounts a
    LEFT JOIN vouchers v 
      ON a.id IN (v.debit_account_id, v.credit_account_id)
      AND v.company_id = ?
    WHERE a.company_id = ?
    GROUP BY a.id
    ORDER BY a.account_type
  `;

  db.query(sql, [companyId, companyId], (err, results) => {
    if (err) return res.status(500).json({ error: "Balance sheet failed" });
    res.json(results);
  });
});

/* =====================================================
   SERVER
===================================================== */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});