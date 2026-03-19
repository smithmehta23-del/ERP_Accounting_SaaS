import React, { useEffect, useMemo, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  layout: { display: "grid", gridTemplateColumns: "0.95fr 1.25fr", gap: 24 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  field: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155" },
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
  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "0.7fr 1.2fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 0.6fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "0.7fr 1.2fr 0.7fr 0.7fr 0.7fr 0.7fr 0.7fr 0.6fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },
};

function ItemsPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    item_code: "",
    item_name: "",
    item_type: "GOODS",
    unit: "NOS",
    sales_rate: "",
    purchase_rate: "",
    tax_percent: "",
    hsn_sac: "",
    track_inventory: true,
    reorder_level: "",
    minimum_level: "",
    maximum_level: "",
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    const res = await API.get("/items");
    setItems(res.data || []);
  };

  const saveItem = async () => {
    await API.post("/items", {
      ...form,
      sales_rate: Number(form.sales_rate || 0),
      purchase_rate: Number(form.purchase_rate || 0),
      tax_percent: Number(form.tax_percent || 0),
      track_inventory: !!form.track_inventory,
      reorder_level: Number(form.reorder_level || 0),
      minimum_level: Number(form.minimum_level || 0),
      maximum_level: Number(form.maximum_level || 0),
    });

    setForm({
      item_code: "",
      item_name: "",
      item_type: "GOODS",
      unit: "NOS",
      sales_rate: "",
      purchase_rate: "",
      tax_percent: "",
      hsn_sac: "",
      track_inventory: true,
      reorder_level: "",
      minimum_level: "",
      maximum_level: "",
    });

    loadItems();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (x) =>
        String(x.item_code || "").toLowerCase().includes(q) ||
        String(x.item_name || "").toLowerCase().includes(q)
    );
  }, [items, query]);

  return (
    <div>
      <div style={styles.title}>Item Master</div>
      <div style={styles.sub}>Manage goods and services with tax, pricing, and reorder controls.</div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <h3>Create Item</h3>

          <div style={styles.field}>
            <label style={styles.label}>Item Code</label>
            <input style={styles.input} value={form.item_code} onChange={(e) => setForm({ ...form, item_code: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Item Name</label>
            <input style={styles.input} value={form.item_name} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Item Type</label>
            <select style={styles.input} value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>
              <option value="GOODS">GOODS</option>
              <option value="SERVICE">SERVICE</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Unit</label>
            <input style={styles.input} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Sales Rate</label>
            <input type="number" style={styles.input} value={form.sales_rate} onChange={(e) => setForm({ ...form, sales_rate: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Purchase Rate</label>
            <input type="number" style={styles.input} value={form.purchase_rate} onChange={(e) => setForm({ ...form, purchase_rate: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Tax %</label>
            <input type="number" style={styles.input} value={form.tax_percent} onChange={(e) => setForm({ ...form, tax_percent: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>HSN / SAC</label>
            <input style={styles.input} value={form.hsn_sac} onChange={(e) => setForm({ ...form, hsn_sac: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Track Inventory</label>
            <select
              style={styles.input}
              value={form.track_inventory ? "YES" : "NO"}
              onChange={(e) => setForm({ ...form, track_inventory: e.target.value === "YES" })}
            >
              <option value="YES">YES</option>
              <option value="NO">NO</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Reorder Level</label>
            <input type="number" style={styles.input} value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Minimum Level</label>
            <input type="number" style={styles.input} value={form.minimum_level} onChange={(e) => setForm({ ...form, minimum_level: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Maximum Level</label>
            <input type="number" style={styles.input} value={form.maximum_level} onChange={(e) => setForm({ ...form, maximum_level: e.target.value })} />
          </div>

          <button style={styles.btn} onClick={saveItem}>Save Item</button>
        </div>

        <div style={styles.card}>
          <h3>Item List</h3>

          <div style={styles.field}>
            <label style={styles.label}>Search</label>
            <input
              style={styles.input}
              placeholder="Search code or item name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div style={styles.tableWrap}>
            <div style={styles.tableHead}>
              <div>Code</div>
              <div>Name</div>
              <div>Type</div>
              <div>Unit</div>
              <div>Tax %</div>
              <div>Reorder</div>
              <div>Minimum</div>
              <div>Track</div>
            </div>

            {filtered.map((row) => (
              <div key={row.id} style={styles.tableRow}>
                <div>{row.item_code}</div>
                <div>{row.item_name}</div>
                <div>{row.item_type}</div>
                <div>{row.unit}</div>
                <div>{Number(row.tax_percent || 0).toFixed(2)}</div>
                <div>{Number(row.reorder_level || 0).toFixed(3)}</div>
                <div>{Number(row.minimum_level || 0).toFixed(3)}</div>
                <div>{Number(row.track_inventory) === 1 ? "YES" : "NO"}</div>
              </div>
            ))}

            {filtered.length === 0 ? <div style={{ padding: 16 }}>No items found.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ItemsPage;