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
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: 14, padding: "11px 15px", fontWeight: 600, cursor: "pointer" },
  tableWrap: { border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden" },
  tableHead: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.8fr 0.8fr", padding: "14px 16px", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  tableRow: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 0.8fr 0.8fr", padding: "14px 16px", borderTop: "1px solid #e2e8f0", fontSize: 14, alignItems: "center" },
};

function FollowupsPage() {
  const [parties, setParties] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [form, setForm] = useState({
    party_id: "",
    sales_invoice_id: "",
    followup_date: new Date().toISOString().slice(0, 10),
    followup_mode: "CALL",
    notes: "",
  });

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [partyRes, followRes] = await Promise.all([
      API.get("/parties"),
      API.get("/collections/followups"),
    ]);
    setParties((partyRes.data || []).filter((p) => p.party_type === "CUSTOMER" || p.party_type === "BOTH"));
    setFollowups(followRes.data || []);
  };

  const saveFollowup = async () => {
    await API.post("/collections/followups", {
      ...form,
      party_id: Number(form.party_id),
      sales_invoice_id: form.sales_invoice_id ? Number(form.sales_invoice_id) : null,
    });
    setForm({
      party_id: "",
      sales_invoice_id: "",
      followup_date: new Date().toISOString().slice(0, 10),
      followup_mode: "CALL",
      notes: "",
    });
    loadAll();
  };

  const markStatus = async (id, status) => {
    await API.post(`/collections/followups/${id}/status`, { status });
    loadAll();
  };

  return (
    <div>
      <div style={styles.title}>Collections Follow-ups</div>
      <div style={styles.sub}>Track call, email, and reminder actions for overdue receivables.</div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <h3>Create Follow-up</h3>

          <div style={styles.field}>
            <label style={styles.label}>Customer</label>
            <select style={styles.input} value={form.party_id} onChange={(e) => setForm({ ...form, party_id: e.target.value })}>
              <option value="">Select customer</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.party_code} - {p.party_name}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Follow-up Date</label>
            <input type="date" style={styles.input} value={form.followup_date} onChange={(e) => setForm({ ...form, followup_date: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Mode</label>
            <select style={styles.input} value={form.followup_mode} onChange={(e) => setForm({ ...form, followup_mode: e.target.value })}>
              <option value="CALL">CALL</option>
              <option value="EMAIL">EMAIL</option>
              <option value="WHATSAPP">WHATSAPP</option>
              <option value="VISIT">VISIT</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Notes</label>
            <input style={styles.input} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <button style={styles.btn} onClick={saveFollowup}>Create Follow-up</button>
        </div>

        <div style={styles.card}>
          <h3>Follow-up List</h3>
          <div style={styles.tableWrap}>
            <div style={styles.tableHead}>
              <div>Date</div>
              <div>Customer</div>
              <div>Mode</div>
              <div>Status</div>
              <div>Action</div>
            </div>

            {followups.map((row) => (
              <div key={row.id} style={styles.tableRow}>
                <div>{row.followup_date}</div>
                <div>{row.party_name}</div>
                <div>{row.followup_mode}</div>
                <div>{row.status}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => markStatus(row.id, "DONE")}>Done</button>
                  <button onClick={() => markStatus(row.id, "SKIPPED")}>Skip</button>
                </div>
              </div>
            ))}

            {followups.length === 0 ? <div style={{ padding: 16 }}>No follow-ups found.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FollowupsPage;