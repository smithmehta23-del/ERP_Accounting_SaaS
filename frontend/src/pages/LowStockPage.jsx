import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.4fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "0.8fr 1.4fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },
  badge: (status) => ({
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      status === "OUT_OF_STOCK"
        ? "#fee2e2"
        : status === "CRITICAL"
        ? "#fef3c7"
        : "#dbeafe",
    color:
      status === "OUT_OF_STOCK"
        ? "#991b1b"
        : status === "CRITICAL"
        ? "#92400e"
        : "#1d4ed8",
  }),
};

function LowStockPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    const res = await API.get("/reports/low-stock");
    setRows(res.data || []);
  };

  return (
    <div>
      <div style={styles.title}>Low Stock Alerts</div>
      <div style={styles.sub}>Items that have reached reorder threshold or run out of stock.</div>

      <div style={styles.card}>
        <div style={styles.tableWrap}>
          <div style={styles.tableHead}>
            <div>Code</div>
            <div>Item</div>
            <div>Unit</div>
            <div>Balance</div>
            <div>Reorder</div>
            <div>Shortage</div>
            <div>Status</div>
          </div>

          {rows.map((row) => (
            <div key={row.id} style={styles.tableRow}>
              <div>{row.item_code}</div>
              <div>{row.item_name}</div>
              <div>{row.unit}</div>
              <div><b>{Number(row.balance_qty || 0).toFixed(3)}</b></div>
              <div>{Number(row.reorder_level || 0).toFixed(3)}</div>
              <div>{Number(row.shortage_qty || 0).toFixed(3)}</div>
              <div>
                <span style={styles.badge(row.status)}>{row.status}</span>
              </div>
            </div>
          ))}

          {rows.length === 0 ? <div style={{ padding: 16 }}>No low stock items found.</div> : null}
        </div>
      </div>
    </div>
  );
}

export default LowStockPage;