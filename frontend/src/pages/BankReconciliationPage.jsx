import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  toolbar: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    background: "#fff",
  },
  btn: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "11px 15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
    marginBottom: 20,
  },
  item: {
    marginBottom: 10,
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: 10,
  },
};

function BankReconciliationPage() {
  const [accounts, setAccounts] = useState([]);
  const [bankAccountId, setBankAccountId] = useState("");
  const [data, setData] = useState({ statement_lines: [], ledger_lines: [] });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const res = await API.get("/accounts");
    const bankAccounts = (res.data || []).filter((a) =>
      String(a.account_name || "").toLowerCase().includes("bank")
    );
    setAccounts(bankAccounts);
    if (bankAccounts.length) {
      setBankAccountId(String(bankAccounts[0].id));
    }
  };

  const loadRecon = async () => {
    if (!bankAccountId) return;
    const res = await API.get(`/bank-reconciliation?bank_account_id=${bankAccountId}`);
    setData(res.data);
  };

  const matchLine = async (statementLineId, voucherLineId) => {
    await API.post("/bank-reconciliation/match", {
      statement_line_id: statementLineId,
      voucher_line_id: voucherLineId,
    });
    loadRecon();
  };

  return (
    <div>
      <div style={styles.title}>Bank Reconciliation</div>
      <div style={styles.sub}>Match bank statement lines against approved ledger entries.</div>

      <div style={styles.toolbar}>
        <select style={styles.input} value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
          <option value="">Select Bank Account</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.account_code} - {a.account_name}
            </option>
          ))}
        </select>
        <button style={styles.btn} onClick={loadRecon}>Load Reconciliation</button>
      </div>

      <div style={styles.card}>
        <h3>Statement Lines</h3>
        {data.statement_lines.map((s) => (
          <div key={s.id} style={styles.item}>
            {s.txn_date} | {s.description_text} | Dr {s.debit_amount} Cr {s.credit_amount} |{" "}
            {s.is_reconciled ? "RECONCILED" : "OPEN"}
            {!s.is_reconciled && data.ledger_lines[0] ? (
              <button
                style={{ marginLeft: 10 }}
                onClick={() => matchLine(s.id, data.ledger_lines[0].voucher_line_id)}
              >
                Match first ledger line
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <h3>Ledger Lines</h3>
        {data.ledger_lines.map((l) => (
          <div key={l.voucher_line_id} style={styles.item}>
            {l.voucher_date} | {l.voucher_no} | {l.narration || l.line_narration} | {l.dc} {l.amount}
          </div>
        ))}
      </div>
    </div>
  );
}

export default BankReconciliationPage;