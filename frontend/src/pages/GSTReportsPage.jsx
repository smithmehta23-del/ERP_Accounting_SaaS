import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  toolbar: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginBottom: 20,
    flexWrap: "wrap",
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
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    marginBottom: 24,
  },
  stat: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
    marginBottom: 20,
  },
};

function GSTReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = `${today.slice(0, 8)}01`;

  const [from, setFrom] = useState(startOfMonth);
  const [to, setTo] = useState(today);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    const res = await API.get(`/reports/gst-summary?from=${from}&to=${to}`);
    setSummary(res.data);
  };

  return (
    <div>
      <div style={styles.title}>GST Reports</div>
      <div style={styles.sub}>Output tax, input tax, and net payable summary for the selected period.</div>

      <div style={styles.toolbar}>
        <input style={styles.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input style={styles.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button style={styles.btn} onClick={loadSummary}>Load GST Summary</button>
      </div>

      {!summary ? null : (
        <>
          <div style={styles.statGrid}>
            <div style={styles.stat}>
              <div style={{ color: "#64748b", fontSize: 13 }}>Output Tax</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>
                ₹{Number(summary.output_tax).toFixed(2)}
              </div>
            </div>
            <div style={styles.stat}>
              <div style={{ color: "#64748b", fontSize: 13 }}>Input Tax</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>
                ₹{Number(summary.input_tax).toFixed(2)}
              </div>
            </div>
            <div style={styles.stat}>
              <div style={{ color: "#64748b", fontSize: 13 }}>Net Tax Payable</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>
                ₹{Number(summary.net_tax_payable).toFixed(2)}
              </div>
            </div>
            <div style={styles.stat}>
              <div style={{ color: "#64748b", fontSize: 13 }}>Sales Invoice Total</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>
                ₹{Number(summary.sales.invoice_total).toFixed(2)}
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3>Sales Tax Summary</h3>
            <div>Taxable Amount: ₹{Number(summary.sales.taxable_amount).toFixed(2)}</div>
            <div>CGST: ₹{Number(summary.sales.cgst_amount).toFixed(2)}</div>
            <div>SGST: ₹{Number(summary.sales.sgst_amount).toFixed(2)}</div>
            <div>IGST: ₹{Number(summary.sales.igst_amount).toFixed(2)}</div>
          </div>

          <div style={styles.card}>
            <h3>Purchase Tax Summary</h3>
            <div>Taxable Amount: ₹{Number(summary.purchases.taxable_amount).toFixed(2)}</div>
            <div>CGST: ₹{Number(summary.purchases.cgst_amount).toFixed(2)}</div>
            <div>SGST: ₹{Number(summary.purchases.sgst_amount).toFixed(2)}</div>
            <div>IGST: ₹{Number(summary.purchases.igst_amount).toFixed(2)}</div>
          </div>
        </>
      )}
    </div>
  );
}

export default GSTReportsPage;