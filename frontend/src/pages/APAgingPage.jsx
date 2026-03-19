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
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  head: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.4fr 1fr 1fr 1fr 1fr 1fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.4fr 1fr 1fr 1fr 1fr 1fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
  },
};

function APAgingPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(today);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    const res = await API.get(`/reports/ap-aging?as_of=${asOf}`);
    setRows(res.data || []);
  };

  const totals = rows.reduce(
    (acc, row) => {
      acc.b0 += Number(row.bucket_0_30 || 0);
      acc.b31 += Number(row.bucket_31_60 || 0);
      acc.b61 += Number(row.bucket_61_90 || 0);
      acc.b90 += Number(row.bucket_90_plus || 0);
      acc.total += Number(row.total_outstanding || 0);
      return acc;
    },
    { b0: 0, b31: 0, b61: 0, b90: 0, total: 0 }
  );

  return (
    <div>
      <div style={styles.title}>A/P Aging</div>
      <div style={styles.sub}>Vendor outstanding aging by invoice date.</div>

      <div style={styles.toolbar}>
        <input
          style={styles.input}
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
        />
        <button style={styles.btn} onClick={loadReport}>
          Load A/P Aging
        </button>
      </div>

      <div style={styles.card}>
        <div style={styles.head}>
          <div>Code</div>
          <div>Party</div>
          <div>0-30</div>
          <div>31-60</div>
          <div>61-90</div>
          <div>90+</div>
          <div>Total</div>
        </div>

        {rows.map((row) => (
          <div key={row.party_id} style={styles.row}>
            <div>{row.party_code}</div>
            <div>{row.party_name}</div>
            <div>₹{Number(row.bucket_0_30).toFixed(2)}</div>
            <div>₹{Number(row.bucket_31_60).toFixed(2)}</div>
            <div>₹{Number(row.bucket_61_90).toFixed(2)}</div>
            <div>₹{Number(row.bucket_90_plus).toFixed(2)}</div>
            <div><b>₹{Number(row.total_outstanding).toFixed(2)}</b></div>
          </div>
        ))}

        <div style={styles.row}>
          <div></div>
          <div><b>Total</b></div>
          <div><b>₹{totals.b0.toFixed(2)}</b></div>
          <div><b>₹{totals.b31.toFixed(2)}</b></div>
          <div><b>₹{totals.b61.toFixed(2)}</b></div>
          <div><b>₹{totals.b90.toFixed(2)}</b></div>
          <div><b>₹{totals.total.toFixed(2)}</b></div>
        </div>
      </div>
    </div>
  );
}

export default APAgingPage;