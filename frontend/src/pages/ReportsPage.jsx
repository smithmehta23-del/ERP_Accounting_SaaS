import React, { useEffect, useState } from "react";
import API from "../api";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { exportTrialBalancePdf } from "../utils/pdfExport";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  filters: {
    display: "flex",
    gap: 12,
    marginBottom: 20,
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
  statGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 16,
    marginBottom: 24,
  },
  stat: {
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
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  head: {
    display: "grid",
    gridTemplateColumns: "0.7fr 1.4fr 1fr 1fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "0.7fr 1.4fr 1fr 1fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
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

function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const startOfMonth = `${today.slice(0, 8)}01`;

  const [from, setFrom] = useState(startOfMonth);
  const [to, setTo] = useState(today);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTrialBalance();
  }, []);

  const loadTrialBalance = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get(`/reports/trial-balance?from=${from}&to=${to}`);
      setRows(res.data || []);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || "Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  };

  const totals = rows.reduce(
    (acc, row) => {
      acc.debit += Number(row.debit || 0);
      acc.credit += Number(row.credit || 0);
      return acc;
    },
    { debit: 0, credit: 0 }
  );

  const exportExcel = () => {
    const exportRows = rows.map((row) => ({
      "Account Code": row.account_code,
      "Account Name": row.account_name,
      Debit: Number(row.debit || 0).toFixed(2),
      Credit: Number(row.credit || 0).toFixed(2),
    }));

    exportRows.push({
      "Account Code": "",
      "Account Name": "TOTAL",
      Debit: totals.debit.toFixed(2),
      Credit: totals.credit.toFixed(2),
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Trial Balance");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });

    const fileData = new Blob([excelBuffer], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
    });

    saveAs(fileData, `trial_balance_${from}_to_${to}.xlsx`);
  };

  return (
    <div>
      <div style={styles.title}>Financial Reports</div>
      <div style={styles.sub}>Trial balance connected to live accounting data.</div>

      {error ? <div style={styles.error}>{error}</div> : null}

      <div style={styles.filters}>
        <input
          style={styles.input}
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <input
          style={styles.input}
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
        <button style={styles.btn} onClick={loadTrialBalance}>
          <button
            style={styles.outlineBtn}
            onClick={() =>
              exportTrialBalancePdf({
                companyName: "ERP Accounting",
                from,
                to,
                rows,
              })
            }
          >
            Export PDF
          </button>
          Load Trial Balance
        </button>
        <button style={styles.outlineBtn} onClick={exportExcel}>
          Export Excel
        </button>
      </div>

      <div style={styles.statGrid}>
        <div style={styles.stat}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Total Debits</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>
            ₹{totals.debit.toFixed(2)}
          </div>
        </div>
        <div style={styles.stat}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Total Credits</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>
            ₹{totals.credit.toFixed(2)}
          </div>
        </div>
        <div style={styles.stat}>
          <div style={{ color: "#64748b", fontSize: 13 }}>Difference</div>
          <div style={{ fontSize: 30, fontWeight: 700, marginTop: 8 }}>
            ₹{(totals.debit - totals.credit).toFixed(2)}
          </div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={{ padding: 20, borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Trial Balance</div>
          <div style={{ color: "#64748b", marginTop: 6 }}>
            Account-wise debit and credit totals for the selected period.
          </div>
        </div>

        <div style={styles.head}>
          <div>Code</div>
          <div>Account</div>
          <div>Debit</div>
          <div>Credit</div>
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>Loading report...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 16 }}>No data found.</div>
        ) : (
          rows.map((row) => (
            <div key={row.id} style={styles.row}>
              <div>{row.account_code}</div>
              <div>{row.account_name}</div>
              <div>₹{Number(row.debit || 0).toFixed(2)}</div>
              <div>₹{Number(row.credit || 0).toFixed(2)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ReportsPage;