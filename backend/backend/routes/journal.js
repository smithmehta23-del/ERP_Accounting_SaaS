const express = require("express");
const router = express.Router();
const db = require("../db");

/**
 * Create Journal Entry
 */
router.post("/", (req, res) => {
  const { entry_date, description, lines } = req.body;

  db.beginTransaction((err) => {
    if (err) return res.status(500).json(err);

    const journalSql = `
      INSERT INTO journal_entries (entry_date, description)
      VALUES (?, ?)
    `;

    db.query(journalSql, [entry_date, description], (err, result) => {
      if (err) {
        return db.rollback(() => res.status(500).json(err));
      }

      const journalId = result.insertId;

      const lineSql = `
        INSERT INTO journal_lines (journal_id, account_id, debit, credit)
        VALUES ?
      `;

      const values = lines.map(l => [
        journalId,
        l.account_id,
        l.debit || 0,
        l.credit || 0
      ]);

      db.query(lineSql, [values], (err) => {
        if (err) {
          return db.rollback(() => res.status(500).json(err));
        }

        db.commit((err) => {
          if (err) {
            return db.rollback(() => res.status(500).json(err));
          }
          res.json({ message: "Journal entry saved" });
        });
      });
    });
  });
});

module.exports = router;
