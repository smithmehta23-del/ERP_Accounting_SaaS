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

function BalanceSheetPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(today);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    const res = await API.get(`/reports/balance-sheet?as_of=${asOf}`);
    setData(res.data);
  };

  return (
    <div>
      <div style={styles.title}>Balance Sheet</div>
      <div style={styles.sub}>Assets, liabilities, and equity as of a selected date.</div>

      <div style={styles.filters}>
        <input style={styles.input} type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        <button style={styles.btn} onClick={loadReport}>Load Balance Sheet</button>
      </div>

      {!data ? null : (
        <>
          <div style={styles.section}>
            <h3>Assets</h3>
            {data.assets.map((r) => (
              <div key={r.account_code} style={styles.row}>
                <div>{r.account_code}</div>
                <div>{r.account_name}</div>
                <div>₹{Number(r.amount).toFixed(2)}</div>
              </div>
            ))}
            <h3 style={{ marginTop: 16 }}>Total Assets: ₹{Number(data.total_assets).toFixed(2)}</h3>
          </div>

          <div style={styles.section}>
            <h3>Liabilities</h3>
            {data.liabilities.map((r) => (
              <div key={r.account_code} style={styles.row}>
                <div>{r.account_code}</div>
                <div>{r.account_name}</div>
                <div>₹{Number(r.amount).toFixed(2)}</div>
              </div>
            ))}
            <h3 style={{ marginTop: 16 }}>Total Liabilities: ₹{Number(data.total_liabilities).toFixed(2)}</h3>
          </div>

          <div style={styles.section}>
            <h3>Equity</h3>
            {data.equity.map((r) => (
              <div key={r.account_code} style={styles.row}>
                <div>{r.account_code}</div>
                <div>{r.account_name}</div>
                <div>₹{Number(r.amount).toFixed(2)}</div>
              </div>
            ))}
            <h3 style={{ marginTop: 16 }}>Total Equity: ₹{Number(data.total_equity).toFixed(2)}</h3>
          </div>

          <div style={styles.section}>
            <h2>
              Assets: ₹{Number(data.total_assets).toFixed(2)} | Liabilities + Equity: ₹{Number(
                data.liabilities_plus_equity
              ).toFixed(2)}
            </h2>
          </div>
        </>
      )}
    </div>
  );
}

export default BalanceSheetPage;