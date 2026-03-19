import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import API from "../api";
import { exportInvoicePdf } from "../utils/pdfExport";

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
      status === "POSTED"
        ? "#dcfce7"
        : status === "CANCELLED"
        ? "#fee2e2"
        : "#e2e8f0",
    color:
      status === "POSTED"
        ? "#166534"
        : status === "CANCELLED"
        ? "#991b1b"
        : "#334155",
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
    fontSize: 22,
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

  tableWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
  },

  tableHead: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },

  tableRow: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.9fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },
};

function money(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

function InvoiceDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const type = (searchParams.get("type") || "sales").toLowerCase();

  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const endpoint =
    type === "purchase" ? `/purchase-invoices/${id}` : `/sales-invoices/${id}`;

  useEffect(() => {
    loadInvoice();
  }, [id, type]);

  const loadInvoice = async () => {
    try {
      setError("");
      const res = await API.get(endpoint);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message || "Failed to load invoice details"
      );
    }
  };

  const totals = useMemo(() => {
    if (!data?.lines) return { qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    return data.lines.reduce(
      (acc, line) => {
        acc.qty += Number(line.qty || 0);
        acc.taxable += Number(line.taxable_amount || 0);
        acc.cgst += Number(line.cgst_amount || 0);
        acc.sgst += Number(line.sgst_amount || 0);
        acc.igst += Number(line.igst_amount || 0);
        acc.total += Number(line.line_total || 0);
        return acc;
      },
      { qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
    );
  }, [data]);

  return (
    <div>
      <div style={styles.title}>
        {type === "purchase" ? "Purchase Invoice Details" : "Sales Invoice Details"}
      </div>
      <div style={styles.sub}>
        Review saved invoice lines, tax totals, outstanding balance, and print-ready PDF.
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      {!data ? (
        <div>Loading invoice...</div>
      ) : (
        <>
          <div style={styles.card}>
            <div style={styles.topRow}>
              <div>
                <div style={styles.bigCode}>{data.header.invoice_no}</div>
                <div style={styles.meta}>
                  {type === "purchase" ? "Vendor" : "Customer"}:{" "}
                  <b>
                    {data.header.party_code} - {data.header.party_name}
                  </b>
                </div>
                <div style={styles.meta}>Invoice Date: {data.header.invoice_date}</div>
                <div style={styles.meta}>GSTIN: {data.header.gstin || "-"}</div>
                <div style={styles.meta}>Phone: {data.header.phone || "-"}</div>
                <div style={styles.meta}>Email: {data.header.email || "-"}</div>
              </div>

              <div>
                <span style={styles.badge(data.header.status)}>
                  {data.header.status}
                </span>
              </div>
            </div>

            <div style={styles.statGrid}>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Taxable</div>
                <div style={styles.statValue}>{money(data.header.taxable_amount)}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>CGST + SGST + IGST</div>
                <div style={styles.statValue}>
                  {money(
                    Number(data.header.cgst_amount || 0) +
                      Number(data.header.sgst_amount || 0) +
                      Number(data.header.igst_amount || 0)
                  )}
                </div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>Invoice Total</div>
                <div style={styles.statValue}>{money(data.header.amount)}</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statLabel}>
                  {type === "purchase" ? "Balance" : "Outstanding"}
                </div>
                <div style={styles.statValue}>{money(data.header.balance_amount)}</div>
              </div>
            </div>

            <div style={styles.btnRow}>
              <button style={styles.outlineBtn} onClick={() => navigate("/invoices")}>
                Back to Invoices
              </button>

              <button
                style={styles.btn}
                onClick={() =>
                  exportInvoicePdf({
                    invoiceType: type === "purchase" ? "PURCHASE" : "SALES",
                    companyName: "ERP Accounting",
                    invoice: data.header,
                    lines: data.lines,
                  })
                }
              >
                Download PDF
              </button>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={{ marginTop: 0, marginBottom: 14 }}>Invoice Lines</h3>

            <div style={styles.tableWrap}>
              <div style={styles.tableHead}>
                <div>Item</div>
                <div>HSN/SAC</div>
                <div>Qty</div>
                <div>Rate</div>
                <div>Taxable</div>
                <div>CGST</div>
                <div>SGST</div>
                <div>Total</div>
              </div>

              {data.lines.map((line) => (
                <div key={line.id} style={styles.tableRow}>
                  <div>
                    <b>{line.item_code}</b> - {line.item_name}
                  </div>
                  <div>{line.hsn_sac || "-"}</div>
                  <div>{Number(line.qty || 0).toFixed(3)} {line.unit || ""}</div>
                  <div>{money(line.rate)}</div>
                  <div>{money(line.taxable_amount)}</div>
                  <div>{money(line.cgst_amount)}</div>
                  <div>{money(line.sgst_amount)}</div>
                  <div><b>{money(line.line_total)}</b></div>
                </div>
              ))}

              {data.lines.length === 0 ? (
                <div style={{ padding: 16 }}>No invoice lines found.</div>
              ) : null}

              {data.lines.length > 0 ? (
                <div style={styles.tableRow}>
                  <div><b>Total</b></div>
                  <div>—</div>
                  <div><b>{Number(totals.qty).toFixed(3)}</b></div>
                  <div>—</div>
                  <div><b>{money(totals.taxable)}</b></div>
                  <div><b>{money(totals.cgst)}</b></div>
                  <div><b>{money(totals.sgst)}</b></div>
                  <div><b>{money(totals.total)}</b></div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default InvoiceDetailsPage;