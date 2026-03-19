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
  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "0.9fr 1fr 1fr 0.8fr 0.8fr 0.8fr 0.9fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "0.9fr 1fr 1fr 0.8fr 0.8fr 0.8fr 0.9fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },
};

function ItemPurchaseRegisterPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 8)}01`;

  const [items, setItems] = useState([]);
  const [itemId, setItemId] = useState("");
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    const res = await API.get("/items");
    setItems(res.data || []);
  };

  const loadReport = async () => {
    const query = itemId
      ? `/reports/item-purchase-register?from=${from}&to=${to}&item_id=${itemId}`
      : `/reports/item-purchase-register?from=${from}&to=${to}`;
    const res = await API.get(query);
    setRows(res.data || []);
  };

  return (
    <div>
      <div style={styles.title}>Item-wise Purchase Register</div>
      <div style={styles.sub}>Purchase invoice lines filtered by item and period.</div>

      <div style={styles.card}>
        <div style={styles.toolbar}>
          <div style={styles.field}>
            <label style={styles.label}>Item</label>
            <select
              style={styles.input}
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
            >
              <option value="">All items</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_code} - {item.item_name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>From</label>
            <input type="date" style={styles.input} value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>To</label>
            <input type="date" style={styles.input} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <button style={styles.btn} onClick={loadReport}>
            Load Purchase Register
          </button>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHead}>
            <div>Invoice</div>
            <div>Party</div>
            <div>Item</div>
            <div>Qty</div>
            <div>Rate</div>
            <div>Taxable</div>
            <div>Total</div>
          </div>

          {rows.map((row, idx) => (
            <div key={`${row.purchase_invoice_id}-${idx}`} style={styles.tableRow}>
              <div>{row.invoice_no}<br />{row.invoice_date}</div>
              <div>{row.party_name}</div>
              <div>{row.item_code} - {row.item_name}</div>
              <div>{Number(row.qty || 0).toFixed(3)} {row.unit}</div>
              <div>₹{Number(row.rate || 0).toFixed(2)}</div>
              <div>₹{Number(row.taxable_amount || 0).toFixed(2)}</div>
              <div><b>₹{Number(row.line_total || 0).toFixed(2)}</b></div>
            </div>
          ))}

          {rows.length === 0 ? <div style={{ padding: 16 }}>No purchase lines found.</div> : null}
        </div>
      </div>
    </div>
  );
}

export default ItemPurchaseRegisterPage;