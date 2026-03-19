import React, { useEffect, useState } from "react";
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
  outlineBtn: {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "9px 12px",
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
    gridTemplateColumns: "1fr 1fr 0.8fr 1.4fr 0.9fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.8fr 1.4fr 0.9fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },
  badge: (closed) => ({
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: closed ? "#fee2e2" : "#dcfce7",
    color: closed ? "#991b1b" : "#166534",
  }),
};

function PeriodClosePage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    period_from: "",
    period_to: "",
    remarks: "",
  });

  useEffect(() => {
    loadRows();
  }, []);

  const loadRows = async () => {
    const res = await API.get("/period-closures");
    setRows(res.data || []);
  };

  const closePeriod = async () => {
    await API.post("/period-closures/close", form);
    setForm({
      period_from: "",
      period_to: "",
      remarks: "",
    });
    loadRows();
  };

  const reopenPeriod = async (id) => {
    await API.post(`/period-closures/${id}/reopen`);
    loadRows();
  };

  return (
    <div>
      <div style={styles.title}>Month-End Closing</div>
      <div style={styles.sub}>
        Close accounting periods to stop posting, edits, settlements, and reversals in completed months.
      </div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <h3>Close Period</h3>

          <div style={styles.field}>
            <label style={styles.label}>Period From</label>
            <input
              type="date"
              style={styles.input}
              value={form.period_from}
              onChange={(e) => setForm({ ...form, period_from: e.target.value })}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Period To</label>
            <input
              type="date"
              style={styles.input}
              value={form.period_to}
              onChange={(e) => setForm({ ...form, period_to: e.target.value })}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Remarks</label>
            <input
              style={styles.input}
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              placeholder="e.g. April books finalized"
            />
          </div>

          <button style={styles.btn} onClick={closePeriod}>
            Close Accounting Period
          </button>
        </div>

        <div style={styles.card}>
          <h3>Closed / Reopened Periods</h3>

          <div style={styles.tableWrap}>
            <div style={styles.tableHead}>
              <div>From</div>
              <div>To</div>
              <div>Status</div>
              <div>Remarks</div>
              <div>Action</div>
            </div>

            {rows.map((row) => (
              <div key={row.id} style={styles.tableRow}>
                <div>{row.period_from}</div>
                <div>{row.period_to}</div>
                <div>
                  <span style={styles.badge(Number(row.is_closed) === 1)}>
                    {Number(row.is_closed) === 1 ? "CLOSED" : "OPENED"}
                  </span>
                </div>
                <div>{row.remarks || "-"}</div>
                <div>
                  {Number(row.is_closed) === 1 ? (
                    <button
                      style={styles.outlineBtn}
                      onClick={() => reopenPeriod(row.id)}
                    >
                      Reopen
                    </button>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            ))}

            {rows.length === 0 ? (
              <div style={{ padding: 16 }}>No period closures found.</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PeriodClosePage;