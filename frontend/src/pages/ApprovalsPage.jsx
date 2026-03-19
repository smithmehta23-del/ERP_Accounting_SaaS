import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  toolbar: {
    display: "flex",
    gap: 12,
    marginBottom: 18,
    flexWrap: "wrap",
    alignItems: "center",
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
  outlineBtn: {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "11px 15px",
    fontWeight: 600,
    cursor: "pointer",
  },
  grid: { display: "grid", gap: 16 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  badge: (status) => ({
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      status === "APPROVED"
        ? "#dcfce7"
        : status === "PREAPPROVED"
          ? "#fef3c7"
          : status === "DRAFT"
            ? "#e2e8f0"
            : "#fee2e2",
    color:
      status === "APPROVED"
        ? "#166534"
        : status === "PREAPPROVED"
          ? "#92400e"
          : status === "DRAFT"
            ? "#334155"
            : "#991b1b",
  }),
  error: {
    color: "#991b1b",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    marginBottom: 16,
  },
  success: {
    color: "#166534",
    background: "#dcfce7",
    border: "1px solid #bbf7d0",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    marginBottom: 16,
  },
};

function ApprovalsPage() {
  const [vouchers, setVouchers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("DRAFT");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadVouchers();
  }, [statusFilter]);

  const loadVouchers = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get(`/vouchers?status=${statusFilter}`);
      setVouchers(res.data || []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to load approval queue");
    } finally {
      setLoading(false);
    }
  };

  const doAction = async (id, action, body = {}) => {
    try {
      setError("");
      setMessage("");
      const res = await API.post(`/vouchers/${id}/${action}`, body);
      setMessage(res.data?.message || "Action completed");
      loadVouchers();
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Action failed"
      );
    }
  };

  return (
    <div>
      <div style={styles.title}>Approval Workflow</div>
      <div style={styles.sub}>
        Maker-checker approval queue connected to live voucher APIs.
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
      {message ? <div style={styles.success}>{message}</div> : null}

      <div style={styles.toolbar}>
        <select
          style={styles.input}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="DRAFT">DRAFT</option>
          <option value="PREAPPROVED">PREAPPROVED</option>
          <option value="APPROVED">APPROVED</option>
          <option value="CANCELLED">CANCELLED</option>
          <option value="ROLLBACK">ROLLBACK</option>
        </select>

        <button style={styles.outlineBtn} onClick={loadVouchers}>
          Refresh
        </button>
      </div>

      <div style={styles.grid}>
        {loading ? (
          <div>Loading vouchers...</div>
        ) : vouchers.length === 0 ? (
          <div>No vouchers found for this status.</div>
        ) : (
          vouchers.map((item) => (
            <div key={item.id} style={styles.card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700 }}>
                    {item.voucher_no}
                  </div>
                  <div style={{ marginTop: 8, color: "#64748b" }}>
                    Type: {item.voucher_type} • Date: {item.voucher_date}
                  </div>
                  <div style={{ marginTop: 10, fontWeight: 600 }}>
                    Narration: {item.narration || "-"}
                  </div>
                </div>
                <span style={styles.badge(item.status)}>{item.status}</span>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
                {item.status === "DRAFT" ? (
                  <button
                    style={styles.btn}
                    onClick={() => doAction(item.id, "preapprove")}
                  >
                    Preapprove
                  </button>
                ) : null}

                {item.status === "DRAFT" || item.status === "PREAPPROVED" ? (
                  <button
                    style={styles.btn}
                    onClick={() => doAction(item.id, "approve")}
                  >
                    Approve
                  </button>
                ) : null}

                {item.status === "DRAFT" ||
                  item.status === "PREAPPROVED" ||
                  item.status === "APPROVED" ? (
                  <button
                    style={styles.outlineBtn}
                    onClick={() => doAction(item.id, "cancel", { mode: "CANCELLED" })}
                  >
                    Cancel
                  </button>
                ) : null}

                {item.status === "APPROVED" ? (
                  <button
                    style={styles.outlineBtn}
                    onClick={() => doAction(item.id, "cancel", { mode: "ROLLBACK" })}
                  >
                    Rollback
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ApprovalsPage;