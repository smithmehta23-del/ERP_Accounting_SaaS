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
    marginBottom: 20,
  },
  toolbar: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "end",
    marginBottom: 18,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "#334155",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    background: "#fff",
    minWidth: 180,
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
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 14,
    marginBottom: 18,
  },
  statCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
  },
  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.8fr 0.8fr 0.8fr 1fr 1.3fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.8fr 0.8fr 0.8fr 1fr 1.3fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },
};

function StockLedgerPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;

  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [data, setData] = useState(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    const res = await API.get("/items");
    const rows = res.data || [];
    setItems(rows);
    if (rows.length && !itemId) {
      setItemId(String(rows[0].id));
    }
  };

  const loadLedger = async () => {
    if (!itemId) return;
    const res = await API.get(`/reports/stock-ledger/${itemId}?from=${from}&to=${to}`);
    setData(res.data);
  };

  return (
    <div>
      <div style={styles.title}>Stock Ledger</div>
      <div style={styles.sub}>Movement history and running quantity by item.</div>

      <div style={styles.card}>
        <div style={styles.toolbar}>
          <div style={styles.field}>
            <label style={styles.label}>Item</label>
            <select
              style={styles.input}
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">Select item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_code} - {item.item_name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>From</label>
            <input
              type="date"
              style={styles.input}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>To</label>
            <input
              type="date"
              style={styles.input}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          <button style={styles.btn} onClick={loadLedger}>
            Load Stock Ledger
          </button>
        </div>

        {!data ? null : (
          <>
            <div style={styles.statGrid}>
              <div style={styles.statCard}>
                <div style={{ color: "#64748b", fontSize: 13 }}>Opening Qty</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                  {Number(data.opening_qty || 0).toFixed(3)}
                </div>
              </div>
              <div style={styles.statCard}>
                <div style={{ color: "#64748b", fontSize: 13 }}>Closing Qty</div>
                <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                  {Number(data.closing_qty || 0).toFixed(3)}
                </div>
              </div>
              <div style={styles.statCard}>
                <div style={{ color: "#64748b", fontSize: 13 }}>Item</div>
                <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>
                  {data.item.item_code} - {data.item.item_name}
                </div>
              </div>
            </div>

            <div style={styles.tableWrap}>
              <div style={styles.tableHead}>
                <div>Date</div>
                <div>Movement</div>
                <div>Qty In</div>
                <div>Qty Out</div>
                <div>Balance</div>
                <div>Reference</div>
                <div>Remarks</div>
              </div>

              {data.rows.map((row) => (
                <div key={row.id} style={styles.tableRow}>
                  <div>{row.txn_date}</div>
                  <div>{row.movement_type}</div>
                  <div>{Number(row.qty_in || 0).toFixed(3)}</div>
                  <div>{Number(row.qty_out || 0).toFixed(3)}</div>
                  <div><b>{Number(row.running_qty || 0).toFixed(3)}</b></div>
                  <div>{row.reference_type} #{row.reference_id}</div>
                  <div>{row.remarks || "-"}</div>
                </div>
              ))}

              {data.rows.length === 0 ? (
                <div style={{ padding: 16 }}>No stock movements found.</div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default StockLedgerPage;