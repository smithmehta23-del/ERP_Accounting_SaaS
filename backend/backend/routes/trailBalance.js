const express = require("express");
const router = express.Router();
const db = require("../db");

router.get("/", (req, res) => {
  const sql = `
    SELECT 
      a.id,
      a.account_name,
      IFNULL(SUM(jl.debit), 0) AS total_debit,
      IFNULL(SUM(jl.credit), 0) AS total_credit,
      IFNULL(SUM(jl.debit - jl.credit), 0) AS balance
    FROM accounts a
    LEFT JOIN journal_lines jl ON a.id = jl.account_id
    GROUP BY a.id, a.account_name
    ORDER BY a.account_name
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);

    const trialBalance = results.map(r => ({
      account_name: r.account_name,
      debit: r.balance > 0 ? r.balance : 0,
      credit: r.balance < 0 ? Math.abs(r.balance) : 0
    }));

    res.json(trialBalance);
  });
});

module.exports = router;
