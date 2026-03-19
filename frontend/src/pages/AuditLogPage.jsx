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
    alignItems: "center",
    marginBottom: 16,
    flexWrap: "wrap",
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    background: "#fff",
    minWidth: 220,
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
    gridTemplateColumns: "1fr 1fr 1fr 1fr 2fr 1fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr 2fr 1fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },
};

function AuditLogPage() {
  const [rows, setRows] = useState([]);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    const params = new URLSearchParams();
    if (action) params.append("action", action);
    if (entityType) params.append("entity_type", entityType);

    const url = params.toString() ? `/audit-logs?${params.toString()}` : "/audit-logs";
    const res = await API.get(url);
    setRows(res.data || []);
  };

  return (
    <div>
      <div style={styles.title}>Audit Log</div>
      <div style={styles.sub}>
        Permanent activity history for financial operations, approvals, settings, closures, and user actions.
      </div>

      <div style={styles.card}>
        <div style={styles.toolbar}>
          <input
            style={styles.input}
            placeholder="Filter by action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
          <input
            style={styles.input}
            placeholder="Filter by entity type"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
          <button style={styles.btn} onClick={loadLogs}>
            Load Audit Log
          </button>
        </div>

        <div style={styles.tableWrap}>
          <div style={styles.tableHead}>
            <div>Date</div>
            <div>User</div>
            <div>Action</div>
            <div>Entity</div>
            <div>Details</div>
            <div>Entity ID</div>
          </div>

          {rows.map((row) => (
            <div key={row.id} style={styles.tableRow}>
              <div>{String(row.created_at).slice(0, 19).replace("T", " ")}</div>
              <div>{row.user_name || "-"}</div>
              <div>{row.action}</div>
              <div>{row.entity_type}</div>
              <div>{row.details || "-"}</div>
              <div>{row.entity_id || "-"}</div>
            </div>
          ))}

          {rows.length === 0 ? (
            <div style={{ padding: 16 }}>No audit logs found.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default AuditLogPage;