import React, { useEffect, useMemo, useState } from "react";
import {
  IndianRupee,
  Wallet,
  Landmark,
  TrendingUp,
  TrendingDown,
  FileText,
  RefreshCw,
  Package,
  AlertTriangle,
  Boxes,
} from "lucide-react";
import API from "./api";

const styles = {
  pageTitle: {
    fontSize: 18,
    color: "#64748b",
    marginBottom: 10,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  hero: {
    marginBottom: 24,
  },
  title: {
    fontSize: 44,
    fontWeight: 800,
    margin: 0,
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    color: "#64748b",
  },
  actionRow: {
    display: "flex",
    gap: 12,
    marginTop: 18,
    flexWrap: "wrap",
  },
  primaryBtn: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  outlineBtn: {
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 18,
    marginBottom: 24,
  },
  kpiCard: {
    background: "#fff",
    borderRadius: 24,
    padding: 20,
    border: "1px solid #e2e8f0",
    boxShadow: "0 6px 22px rgba(15,23,42,0.05)",
  },
  kpiTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  kpiLabel: {
    color: "#64748b",
    fontSize: 13,
    marginBottom: 8,
    fontWeight: 600,
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.1,
  },
  kpiFooter: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: 700,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    background: "#f8fafc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mainGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.9fr",
    gap: 20,
    marginBottom: 24,
  },
  card: {
    background: "#fff",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 6px 22px rgba(15,23,42,0.05)",
    overflow: "hidden",
  },
  cardHeader: {
    padding: "20px 22px 14px",
    borderBottom: "1px solid #eef2f7",
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
  },
  cardSub: {
    marginTop: 6,
    fontSize: 14,
    color: "#64748b",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1.7fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1.7fr",
    padding: "15px 16px",
    borderTop: "1px solid #eef2f7",
    fontSize: 14,
    alignItems: "center",
  },
  metricList: {
    display: "grid",
    gap: 14,
  },
  metricItem: {
    padding: 16,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  metricTitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  metricValue: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: 800,
    color: "#0f172a",
  },
  metricSub: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
  },
  empty: {
    padding: 24,
    color: "#64748b",
    fontSize: 14,
  },
  error: {
    marginBottom: 18,
    color: "#991b1b",
    background: "#fee2e2",
    border: "1px solid #fecaca",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    fontWeight: 600,
  },
};

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Dashboard() {
  const [data, setData] = useState({
    revenue: 0,
    expense: 0,
    profit: 0,
    receivables: 0,
    payables: 0,
    total_stock_items: 0,
    low_stock_items: 0,
    out_of_stock_items: 0,
    recent_vouchers: [],
  });
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setError("");
      const res = await API.get("/dashboard/summary");
      setData({
        revenue: Number(res.data?.revenue || 0),
        expense: Number(res.data?.expense || 0),
        profit: Number(res.data?.profit || 0),
        receivables: Number(res.data?.receivables || 0),
        payables: Number(res.data?.payables || 0),
        total_stock_items: Number(res.data?.total_stock_items || 0),
        low_stock_items: Number(res.data?.low_stock_items || 0),
        out_of_stock_items: Number(res.data?.out_of_stock_items || 0),
        recent_vouchers: res.data?.recent_vouchers || [],
      });
    } catch (error) {
      console.error("Dashboard API error:", error);
      setError("Unable to load live dashboard data.");
      setData({
        revenue: 0,
        expense: 0,
        profit: 0,
        receivables: 0,
        payables: 0,
        total_stock_items: 0,
        low_stock_items: 0,
        out_of_stock_items: 0,
        recent_vouchers: [],
      });
    }
  };

  const workingCapital = useMemo(() => data.receivables - data.payables, [data]);

  const kpis = [
    {
      label: "Revenue",
      value: formatCurrency(data.revenue),
      icon: TrendingUp,
      tone: "#166534",
      note: "Income booked",
    },
    {
      label: "Expenses",
      value: formatCurrency(data.expense),
      icon: TrendingDown,
      tone: "#b45309",
      note: "Cost booked",
    },
    {
      label: "Net Profit",
      value: formatCurrency(data.profit),
      icon: IndianRupee,
      tone: data.profit >= 0 ? "#166534" : "#991b1b",
      note: data.profit >= 0 ? "Positive margin" : "Loss position",
    },
    {
      label: "Receivables",
      value: formatCurrency(data.receivables),
      icon: Wallet,
      tone: "#1d4ed8",
      note: "Outstanding from customers",
    },
    {
      label: "Payables",
      value: formatCurrency(data.payables),
      icon: Landmark,
      tone: "#7c3aed",
      note: "Outstanding to vendors",
    },
    {
      label: "Stock Items",
      value: String(data.total_stock_items || 0),
      icon: Boxes,
      tone: "#0f766e",
      note: "Tracked inventory items",
    },
    {
      label: "Low Stock",
      value: String(data.low_stock_items || 0),
      icon: AlertTriangle,
      tone: "#b45309",
      note: "Needs replenishment",
    },
    {
      label: "Out of Stock",
      value: String(data.out_of_stock_items || 0),
      icon: Package,
      tone: "#991b1b",
      note: "Immediate attention",
    },
  ];

  return (
    <div>
      <div style={styles.pageTitle}>Executive Overview</div>

      <div style={styles.hero}>
        <h1 style={styles.title}>Accounting & Inventory Dashboard</h1>
        <div style={styles.subtitle}>
          Live control center for finance, receivables, payables, and inventory health.
        </div>
        <div style={styles.actionRow}>
          <button style={styles.primaryBtn}>
            <FileText size={16} />
            Review Business Position
          </button>
          <button style={styles.outlineBtn} onClick={loadDashboard}>
            <RefreshCw size={16} />
            Refresh Dashboard
          </button>
        </div>
      </div>

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.kpiGrid}>
        {kpis.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} style={styles.kpiCard}>
              <div style={styles.kpiTop}>
                <div>
                  <div style={styles.kpiLabel}>{item.label}</div>
                  <div style={styles.kpiValue}>{item.value}</div>
                </div>
                <div style={styles.iconWrap}>
                  <Icon size={20} color={item.tone} />
                </div>
              </div>
              <div style={{ ...styles.kpiFooter, color: item.tone }}>{item.note}</div>
            </div>
          );
        })}
      </div>

      <div style={styles.mainGrid}>
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>Recent Vouchers</h3>
            <div style={styles.cardSub}>Latest accounting movements posted in the system.</div>
          </div>

          <div>
            <div style={styles.tableHead}>
              <div>Voucher</div>
              <div>Date</div>
              <div>Narration</div>
            </div>

            {data.recent_vouchers.length === 0 ? (
              <div style={styles.empty}>No recent vouchers found.</div>
            ) : (
              data.recent_vouchers.map((v, i) => (
                <div key={i} style={styles.tableRow}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{v.voucher_no}</div>
                  <div>{v.voucher_date}</div>
                  <div>{v.narration || "-"}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={styles.metricList}>
          <div style={styles.metricItem}>
            <div style={styles.metricTitle}>Working Capital Snapshot</div>
            <div style={styles.metricValue}>{formatCurrency(workingCapital)}</div>
            <div style={styles.metricSub}>Receivables less payables position.</div>
          </div>

          <div style={styles.metricItem}>
            <div style={styles.metricTitle}>Inventory Risk</div>
            <div style={styles.metricValue}>
              {Number(data.low_stock_items || 0) + Number(data.out_of_stock_items || 0)}
            </div>
            <div style={styles.metricSub}>Items needing replenishment or action.</div>
          </div>

          <div style={styles.metricItem}>
            <div style={styles.metricTitle}>Receivable Pressure</div>
            <div style={styles.metricValue}>
              {data.revenue > 0
                ? `${((data.receivables / data.revenue) * 100).toFixed(1)}%`
                : "0.0%"}
            </div>
            <div style={styles.metricSub}>Receivables as a share of revenue.</div>
          </div>

          <div style={styles.metricItem}>
            <div style={styles.metricTitle}>Expense Ratio</div>
            <div style={styles.metricValue}>
              {data.revenue > 0
                ? `${((data.expense / data.revenue) * 100).toFixed(1)}%`
                : "0.0%"}
            </div>
            <div style={styles.metricSub}>Expenses as a share of revenue.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;