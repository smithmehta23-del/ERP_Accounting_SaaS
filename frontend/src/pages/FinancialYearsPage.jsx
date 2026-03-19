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
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: 14, padding: "11px 15px", fontWeight: 600, cursor: "pointer", marginRight: 8, marginTop: 8 },
  tableWrap: { border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden" },
  tableHead: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.8fr 1.2fr", padding: "14px 16px", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  tableRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.8fr 1.2fr", padding: "14px 16px", borderTop: "1px solid #e2e8f0", fontSize: 14, alignItems: "center" },
  badge: (status) => ({
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      status === "OPEN" ? "#dcfce7" :
      status === "CLOSED" ? "#fee2e2" : "#e2e8f0",
    color:
      status === "OPEN" ? "#166534" :
      status === "CLOSED" ? "#991b1b" : "#334155",
  }),
};

function FinancialYearsPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    year_code: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const res = await API.get("/financial-years");
    setRows(res.data || []);
  };

  const createFY = async () => {
    await API.post("/financial-years", form);
    setForm({ year_code: "", start_date: "", end_date: "" });
    loadData();
  };

  const openFY = async (id) => {
    await API.post(`/financial-years/${id}/open`);
    loadData();
  };

  const closeFY = async (id) => {
    await API.post(`/financial-years/${id}/close`);
    loadData();
  };

  return (
    <div>
      <div style={styles.title}>Financial Years</div>
      <div style={styles.sub}>Control accounting years, year-end close, and opening balance carry forward.</div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <h3>Create Financial Year</h3>

          <div style={styles.field}>
            <label style={styles.label}>Year Code</label>
            <input style={styles.input} value={form.year_code} onChange={(e) => setForm({ ...form, year_code: e.target.value })} placeholder="FY2026-27" />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Start Date</label>
            <input type="date" style={styles.input} value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>End Date</label>
            <input type="date" style={styles.input} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>

          <button style={styles.btn} onClick={createFY}>Create Financial Year</button>
        </div>

        <div style={styles.card}>
          <h3>Financial Year Register</h3>

          <div style={styles.tableWrap}>
            <div style={styles.tableHead}>
              <div>Year</div>
              <div>Start</div>
              <div>End</div>
              <div>Status</div>
              <div>Actions</div>
            </div>

            {rows.map((row) => (
              <div key={row.id} style={styles.tableRow}>
                <div>{row.year_code}</div>
                <div>{row.start_date}</div>
                <div>{row.end_date}</div>
                <div><span style={styles.badge(row.status)}>{row.status}</span></div>
                <div>
                  <button style={styles.btn} onClick={() => openFY(row.id)}>Open</button>
                  {row.status === "OPEN" ? (
                    <button style={styles.btn} onClick={() => closeFY(row.id)}>Close Year</button>
                  ) : null}
                </div>
              </div>
            ))}

            {rows.length === 0 ? <div style={{ padding: 16 }}>No financial years found.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FinancialYearsPage;