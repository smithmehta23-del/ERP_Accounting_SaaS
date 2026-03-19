import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  filters: {
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
  section: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
    marginBottom: 20,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.4fr 1fr",
    padding: "12px 0",
    borderTop: "1px solid #f1f5f9",
  },
};

function ProfitLossPage() {
  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = `${today.slice(0, 8)}01`;

  const [from, setFrom] = useState(startOfMonth);
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    const res = await API.get(`/reports/pnl?from=${from}&to=${to}`);
    setData(res.data);
  };

  return (
    <div>
      <div style={styles.title}>Profit & Loss</div>
      <div style={styles.sub}>Income, expense, and net profit for the selected period.</div>

      <div style={styles.filters}>
        <input style={styles.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input style={styles.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button style={styles.btn} onClick={loadReport}>Load P&L</button>
      </div>

      {!data ? null : (
        <>
          <div style={styles.section}>
            <h3>Income</h3>
            {data.income.map((r) => (
              <div key={r.account_code} style={styles.row}>
                <div>{r.account_code}</div>
                <div>{r.account_name}</div>
                <div>₹{Number(r.amount).toFixed(2)}</div>
              </div>
            ))}
            <h3 style={{ marginTop: 16 }}>Total Income: ₹{Number(data.total_income).toFixed(2)}</h3>
          </div>

          <div style={styles.section}>
            <h3>Expenses</h3>
            {data.expenses.map((r) => (
              <div key={r.account_code} style={styles.row}>
                <div>{r.account_code}</div>
                <div>{r.account_name}</div>
                <div>₹{Number(r.amount).toFixed(2)}</div>
              </div>
            ))}
            <h3 style={{ marginTop: 16 }}>Total Expense: ₹{Number(data.total_expense).toFixed(2)}</h3>
          </div>

          <div style={styles.section}>
            <h2>Net Profit: ₹{Number(data.net_profit).toFixed(2)}</h2>
          </div>
        </>
      )}
    </div>
  );
}

export default ProfitLossPage;