import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../api";
import { exportVoucherPdf } from "../utils/pdfExport";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },

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

  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
    marginBottom: 20,
  },

  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },

  voucherNo: {
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },

  meta: {
    color: "#64748b",
    fontSize: 14,
    marginBottom: 8,
  },

  narration: {
    fontSize: 15,
    color: "#0f172a",
  },

  badge: (status) => ({
    display: "inline-block",
    padding: "7px 12px",
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

  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 14,
    marginTop: 18,
  },

  statCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
  },

  statLabel: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 8,
  },

  statValue: {
    fontSize: 24,
    fontWeight: 800,
    color: "#0f172a",
  },

  btnRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 20,
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

  sectionTitle: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 14,
    color: "#0f172a",
  },

  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },

  tableHead: {
    display: "grid",
    gridTemplateColumns: "0.7fr 1fr 1.7fr 0.7fr 0.9fr 1.3fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns: "0.7fr 1fr 1.7fr 0.7fr 0.9fr 1.3fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },

  amountDebit: {
    color: "#166534",
    fontWeight: 700,
  },

  amountCredit: {
    color: "#1d4ed8",
    fontWeight: 700,
  },
};

function VoucherDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadVoucher();
  }, [id]);

  const loadVoucher = async () => {
    try {
      setError("");
      const res = await API.get(`/vouchers/${id}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to load voucher details");
    }
  };

  const doAction = async (action, body = {}) => {
    try {
      setError("");
      setMessage("");
      const res = await API.post(`/vouchers/${id}/${action}`, body);
      setMessage(res.data?.message || "Action completed");
      await loadVoucher();
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
      <div style={styles.title}>Voucher Details</div>
      <div style={styles.sub}>
        Review voucher header, lines, totals, status controls, and PDF output.
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}
      {message ? <div style={styles.success}>{message}</div> : null}

      {!data ? (
        <div>Loading voucher...</div>
      ) : (
        <>
          <div style={styles.card}>
            <div style={styles.topRow}>
              <div>
                <div style={styles.voucherNo}>{data.header.voucher_no}</div>
                <div style={styles.meta}>
                  {data.header.voucher_type} • {data.header.voucher_date}
                </div>
                <div style={styles.narration}>
                  Narration: <b>{data.header.narration || "-"}</b>
                </div>
              </div>

              <div>
                <span style={styles.badge(data.header.status)}>
                  {data.header.status}
                </span>
              </div>
            </div>

            <div style={styles.statGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Company ID</div>
                <div style={styles.statValue}>{data.header.company_id}</div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statLabel}>Created By</div>
                <div style={styles.statValue}>{data.header.created_by || "-"}</div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statLabel}>Total Debit</div>
                <div style={styles.statValue}>
                  ₹{Number(data.totals?.debit || 0).toFixed(2)}
                </div>
              </div>

              <div style={styles.statCard}>
                <div style={styles.statLabel}>Total Credit</div>
                <div style={styles.statValue}>
                  ₹{Number(data.totals?.credit || 0).toFixed(2)}
                </div>
              </div>
            </div>

            <div style={styles.btnRow}>
              <button
                style={styles.outlineBtn}
                onClick={() => navigate("/vouchers")}
              >
                Back to Vouchers
              </button>

              <button
                style={styles.outlineBtn}
                onClick={() =>
                  exportVoucherPdf({
                    companyName: "ERP Accounting",
                    voucher: data.header,
                    lines: data.lines,
                  })
                }
              >
                Download PDF
              </button>

              {data.header.status === "DRAFT" ? (
                <button
                  style={styles.btn}
                  onClick={() => doAction("preapprove")}
                >
                  Preapprove
                </button>
              ) : null}

              {data.header.status === "DRAFT" ||
                data.header.status === "PREAPPROVED" ? (
                <button style={styles.btn} onClick={() => doAction("approve")}>
                  Approve
                </button>
              ) : null}

              {["DRAFT", "PREAPPROVED", "APPROVED"].includes(
                data.header.status
              ) ? (
                <button
                  style={styles.outlineBtn}
                  onClick={() => doAction("cancel", { mode: "CANCELLED" })}
                >
                  Cancel
                </button>
              ) : null}

              {data.header.status === "APPROVED" ? (
                <button
                  style={styles.outlineBtn}
                  onClick={() => doAction("cancel", { mode: "ROLLBACK" })}
                >
                  Rollback
                </button>
              ) : null}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionTitle}>Voucher Lines</div>

            <div style={styles.tableWrap}>
              <div style={styles.tableHead}>
                <div>Line</div>
                <div>Code</div>
                <div>Account</div>
                <div>DC</div>
                <div>Amount</div>
                <div>Narration</div>
              </div>

              {data.lines.length === 0 ? (
                <div style={{ padding: 16 }}>No voucher lines found.</div>
              ) : (
                data.lines.map((line) => (
                  <div key={line.id} style={styles.tableRow}>
                    <div>{line.line_no}</div>
                    <div>{line.account_code}</div>
                    <div>{line.account_name}</div>
                    <div>{line.dc}</div>
                    <div
                      style={
                        line.dc === "D"
                          ? styles.amountDebit
                          : styles.amountCredit
                      }
                    >
                      ₹{Number(line.amount || 0).toFixed(2)}
                    </div>
                    <div>{line.line_narration || "-"}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default VoucherDetailsPage;