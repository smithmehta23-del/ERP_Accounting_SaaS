import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  bigCode: {
    fontSize: 30,
    fontWeight: 800,
    color: "#0f172a",
    marginBottom: 6,
  },
  meta: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 6,
  },
  badge: (status) => ({
    display: "inline-block",
    padding: "7px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      status === "CLOSED" ? "#dcfce7" :
      status === "CANCELLED" ? "#fee2e2" :
      status === "SENT" ? "#dbeafe" : "#e2e8f0",
    color:
      status === "CLOSED" ? "#166534" :
      status === "CANCELLED" ? "#991b1b" :
      status === "SENT" ? "#1d4ed8" : "#334155",
  }),
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
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginTop: 20,
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
  },
  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.8fr 0.9fr 0.9fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
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
  error: {
    color: "#991b1b",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: 12,
    padding: "10px 12px",
    fontSize: 14,
    marginBottom: 16,
  },
};

function money(v) {
  return `₹${Number(v || 0).toFixed(2)}`;
}

function PurchaseOrderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    const res = await API.get(`/purchase-orders/${id}`);
    setData(res.data);
  };

  const changeStatus = async (status) => {
    try {
      setError("");
      setMessage("");
      await API.post(`/purchase-orders/${id}/status`, { status });
      setMessage(`Purchase order marked ${status}.`);
      loadData();
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update status");
    }
  };

  const convertToInvoice = async () => {
    try {
      setError("");
      setMessage("");

      if (!invoiceNo || !invoiceDate) {
        setError("Invoice number and invoice date are required.");
        return;
      }

      const res = await API.post(`/purchase-orders/${id}/convert-to-invoice`, {
        invoice_no: invoiceNo,
        invoice_date: invoiceDate,
      });

      setMessage(res.data?.message || "Purchase order converted.");
      loadData();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to convert PO"
      );
    }
  };

  return (
    <div>
      <div style={styles.title}>Purchase Order Details</div>
      <div style={styles.sub}>Review purchase order lines, manage status, and convert PO into purchase invoice.</div>

      {message ? <div style={styles.success}>{message}</div> : null}
      {error ? <div style={styles.error}>{error}</div> : null}

      {!data ? (
        <div>Loading purchase order...</div>
      ) : (
        <>
          <div style={styles.card}>
            <div style={styles.topRow}>
              <div>
                <div style={styles.bigCode}>{data.header.po_no}</div>
                <div style={styles.meta}>
                  Vendor: <b>{data.header.party_code} - {data.header.party_name}</b>
                </div>
                <div style={styles.meta}>PO Date: {data.header.po_date}</div>
                <div style={styles.meta}>Expected Date: {data.header.expected_date || "-"}</div>
                <div style={styles.meta}>Remarks: {data.header.remarks || "-"}</div>
                <div style={styles.meta}>Total: <b>{money(data.header.total_amount)}</b></div>
              </div>
              <div>
                <span style={styles.badge(data.header.status)}>{data.header.status}</span>
              </div>
            </div>

            <div style={styles.btnRow}>
              <button style={styles.outlineBtn} onClick={() => navigate("/purchase-orders")}>
                Back to Purchase Orders
              </button>
              <button style={styles.btn} onClick={() => changeStatus("SENT")}>Mark Sent</button>
              <button style={styles.btn} onClick={() => changeStatus("PARTIAL")}>Mark Partial</button>
              <button style={styles.btn} onClick={() => changeStatus("CLOSED")}>Mark Closed</button>
              <button style={styles.outlineBtn} onClick={() => changeStatus("CANCELLED")}>
                Cancel
              </button>
            </div>

            <div style={styles.fieldGrid}>
              <div style={styles.field}>
                <label style={styles.label}>Purchase Invoice No</label>
                <input
                  style={styles.input}
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="PI-0001"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Purchase Invoice Date</label>
                <input
                  type="date"
                  style={styles.input}
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
            </div>

            <div style={styles.btnRow}>
              <button
                style={styles.btn}
                onClick={convertToInvoice}
                disabled={["CLOSED", "CANCELLED"].includes(String(data.header.status || "").toUpperCase())}
              >
                Convert to Purchase Invoice
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>PO Lines</h3>

            <div style={styles.tableWrap}>
              <div style={styles.tableHead}>
                <div>Item</div>
                <div>Qty</div>
                <div>Rate</div>
                <div>Tax %</div>
                <div>Taxable</div>
                <div>Total</div>
              </div>

              {data.lines.map((line) => (
                <div key={line.id} style={styles.tableRow}>
                  <div><b>{line.item_code}</b> - {line.item_name}</div>
                  <div>{Number(line.qty || 0).toFixed(3)} {line.unit || ""}</div>
                  <div>{money(line.rate)}</div>
                  <div>{Number(line.tax_percent || 0).toFixed(2)}%</div>
                  <div>{money(line.taxable_amount)}</div>
                  <div><b>{money(line.line_total)}</b></div>
                </div>
              ))}

              {data.lines.length === 0 ? <div style={{ padding: 16 }}>No PO lines found.</div> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PurchaseOrderDetailsPage;