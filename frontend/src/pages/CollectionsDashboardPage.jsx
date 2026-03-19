import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  statGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 },
  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
    marginBottom: 20,
  },
  tableWrap: { border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden" },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.8fr 0.8fr 0.8fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 0.8fr 0.8fr 0.8fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
  },
  badge: (status) => ({
    display: "inline-block",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background:
      status === "OVER_LIMIT"
        ? "#fee2e2"
        : status === "HIGH_RISK"
        ? "#fef3c7"
        : status === "WATCH"
        ? "#dbeafe"
        : "#dcfce7",
    color:
      status === "OVER_LIMIT"
        ? "#991b1b"
        : status === "HIGH_RISK"
        ? "#92400e"
        : status === "WATCH"
        ? "#1d4ed8"
        : "#166534",
  }),
};

function money(v) {
  return `₹${Number(v || 0).toFixed(2)}`;
}

function CollectionsDashboardPage() {
  const [summary, setSummary] = useState({
    total_outstanding: 0,
    overdue_outstanding: 0,
    customers_with_dues: 0,
    open_followups: 0,
  });
  const [overdue, setOverdue] = useState([]);
  const [risk, setRisk] = useState([]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [s, o, r] = await Promise.all([
      API.get("/collections/summary"),
      API.get("/collections/overdue-invoices"),
      API.get("/collections/customer-risk"),
    ]);

    setSummary(s.data || {});
    setOverdue(o.data || []);
    setRisk(r.data || []);
  };

  return (
    <div>
      <div style={styles.title}>Collections Dashboard</div>
      <div style={styles.sub}>Receivable control, overdue monitoring, and customer credit risk.</div>

      <div style={styles.statGrid}>
        <div style={styles.statCard}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Total Outstanding</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{money(summary.total_outstanding)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Overdue Outstanding</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{money(summary.overdue_outstanding)}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Customers With Dues</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{summary.customers_with_dues}</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Open Follow-ups</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 8 }}>{summary.open_followups}</div>
        </div>
      </div>

      <div style={styles.card}>
        <h3>Overdue Invoices</h3>
        <div style={styles.tableWrap}>
          <div style={styles.tableHead}>
            <div>Invoice</div>
            <div>Customer</div>
            <div>Balance</div>
            <div>Overdue Days</div>
            <div>Credit Limit</div>
          </div>

          {overdue.map((row) => (
            <div key={row.id} style={styles.tableRow}>
              <div>{row.invoice_no}<br />{row.invoice_date}</div>
              <div>{row.party_name}</div>
              <div>{money(row.balance_amount)}</div>
              <div>{row.overdue_days}</div>
              <div>{money(row.credit_limit)}</div>
            </div>
          ))}

          {overdue.length === 0 ? <div style={{ padding: 16 }}>No overdue invoices found.</div> : null}
        </div>
      </div>

      <div style={styles.card}>
        <h3>Customer Risk</h3>
        <div style={styles.tableWrap}>
          <div style={styles.tableHead}>
            <div>Customer</div>
            <div>Outstanding</div>
            <div>Credit Limit</div>
            <div>Utilization %</div>
            <div>Status</div>
          </div>

          {risk.map((row) => (
            <div key={row.party_id} style={styles.tableRow}>
              <div>{row.party_code} - {row.party_name}</div>
              <div>{money(row.outstanding)}</div>
              <div>{money(row.credit_limit)}</div>
              <div>{Number(row.credit_utilization_percent || 0).toFixed(2)}%</div>
              <div><span style={styles.badge(row.risk_status)}>{row.risk_status}</span></div>
            </div>
          ))}

          {risk.length === 0 ? <div style={{ padding: 16 }}>No customer risk data found.</div> : null}
        </div>
      </div>
    </div>
  );
}

export default CollectionsDashboardPage;