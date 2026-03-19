import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  filters: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr auto",
    gap: 16,
    marginBottom: 20,
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
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "0.8fr 0.9fr 1.4fr 0.8fr 0.8fr 1fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "0.8fr 0.9fr 1.4fr 0.8fr 0.8fr 1fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
  },
  error: {
    color: "#991b1b",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    marginBottom: 16,
  },
};

function LedgerPage() {
  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = `${today.slice(0, 8)}01`;

  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState(startOfMonth);
  const [to, setTo] = useState(today);
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await API.get("/accounts");
      setAccounts(res.data || []);
      if (res.data?.length) {
        setAccountId(String(res.data[0].id));
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to load accounts");
    }
  };

  const loadLedger = async () => {
    try {
      if (!accountId) {
        setError("Please select an account");
        return;
      }
      setError("");
      const res = await API.get(
        `/reports/ledger/${accountId}?from=${from}&to=${to}`
      );
      setLedger(res.data);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to load ledger");
    }
  };

  return (
    <div>
      <div style={styles.title}>General Ledger</div>
      <div style={styles.sub}>
        Detailed ledger with running balance from live backend data.
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.filters}>
        <select
          style={styles.input}
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
        >
          <option value="">Select account</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.account_code} - {acc.account_name}
            </option>
          ))}
        </select>

        <input
          style={styles.input}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />

        <input
          style={styles.input}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />

        <button style={styles.btn} onClick={loadLedger}>
          View Ledger
        </button>
      </div>

      <div style={styles.card}>
        <div style={{ padding: 20, borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {ledger?.account?.account_name || "Ledger"}
          </div>
          <div style={{ color: "#64748b", marginTop: 6 }}>
            Opening Balance: ₹{Number(ledger?.opening_balance || 0).toFixed(2)} •
            Closing Balance: ₹{Number(ledger?.closing_balance || 0).toFixed(2)}
          </div>
        </div>

        <div style={styles.tableHead}>
          <div>Date</div>
          <div>Voucher</div>
          <div>Narration</div>
          <div>Debit</div>
          <div>Credit</div>
          <div>Running Balance</div>
        </div>

        {!ledger ? (
          <div style={{ padding: 16 }}>Select account and date range to load ledger.</div>
        ) : ledger.transactions.length === 0 ? (
          <div style={{ padding: 16 }}>No ledger transactions found.</div>
        ) : (
          ledger.transactions.map((row, i) => (
            <div key={i} style={styles.tableRow}>
              <div>{row.voucher_date}</div>
              <div>{row.voucher_no}</div>
              <div>{row.line_narration || row.header_narration || "-"}</div>
              <div>{row.dc === "D" ? `₹${Number(row.amount).toFixed(2)}` : "-"}</div>
              <div>{row.dc === "C" ? `₹${Number(row.amount).toFixed(2)}` : "-"}</div>
              <div style={{ fontWeight: 700 }}>
                ₹{Number(row.running_balance || 0).toFixed(2)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default LedgerPage;