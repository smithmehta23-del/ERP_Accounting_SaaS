import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  layout: { display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 24 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  field: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155" },
  input: { border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 14px", fontSize: 14, background: "#fff" },
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: 14, padding: "11px 15px", fontWeight: 600, cursor: "pointer", marginRight: 8 },
  tableWrap: { border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden" },
  tableHead: { display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr 0.8fr 0.8fr", padding: "14px 16px", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  tableRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1.5fr 0.8fr 0.8fr", padding: "14px 16px", borderTop: "1px solid #e2e8f0", fontSize: 14, alignItems: "center" },
};

function PostingLocksPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    lock_from: "",
    lock_to: "",
    reason: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const res = await API.get("/posting-locks");
    setRows(res.data || []);
  };

  const createLock = async () => {
    await API.post("/posting-locks", form);
    setForm({ lock_from: "", lock_to: "", reason: "" });
    loadData();
  };

  const toggleLock = async (id) => {
    await API.post(`/posting-locks/${id}/toggle`);
    loadData();
  };

  return (
    <div>
      <div style={styles.title}>Posting Locks</div>
      <div style={styles.sub}>Protect closed periods and control backdated posting.</div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <h3>Create Posting Lock</h3>

          <div style={styles.field}>
            <label style={styles.label}>Lock From</label>
            <input type="date" style={styles.input} value={form.lock_from} onChange={(e) => setForm({ ...form, lock_from: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Lock To</label>
            <input type="date" style={styles.input} value={form.lock_to} onChange={(e) => setForm({ ...form, lock_to: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Reason</label>
            <input style={styles.input} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>

          <button style={styles.btn} onClick={createLock}>Create Lock</button>
        </div>

        <div style={styles.card}>
          <h3>Posting Lock Register</h3>

          <div style={styles.tableWrap}>
            <div style={styles.tableHead}>
              <div>From</div>
              <div>To</div>
              <div>Reason</div>
              <div>Active</div>
              <div>Action</div>
            </div>

            {rows.map((row) => (
              <div key={row.id} style={styles.tableRow}>
                <div>{row.lock_from}</div>
                <div>{row.lock_to}</div>
                <div>{row.reason || "-"}</div>
                <div>{Number(row.is_active) === 1 ? "YES" : "NO"}</div>
                <div>
                  <button style={styles.btn} onClick={() => toggleLock(row.id)}>Toggle</button>
                </div>
              </div>
            ))}

            {rows.length === 0 ? <div style={{ padding: 16 }}>No posting locks found.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PostingLocksPage;