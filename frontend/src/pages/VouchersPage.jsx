import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

const styles = {
  pageTitle: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  pageSub: { color: "#64748b", marginBottom: 24 },
  grid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 24,
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 20,
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
  },
  input: {
    padding: 10,
    borderRadius: 10,
    border: "1px solid #cbd5e1",
  },
  lineGrid: {
    display: "grid",
    gridTemplateColumns: "1.4fr 0.6fr 0.8fr 1.2fr auto",
    gap: 10,
    marginBottom: 10,
  },
  btn: {
    background: "#0f172a",
    color: "white",
    padding: "10px 16px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
  },
  outlineBtn: {
    border: "1px solid #cbd5e1",
    padding: "10px 16px",
    borderRadius: 10,
    background: "white",
    cursor: "pointer",
  },
  totals: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    marginTop: 18,
  },
  totalCard: {
    padding: 14,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  voucherItem: {
    padding: 12,
    borderBottom: "1px solid #eee",
    cursor: "pointer",
  },
};

function VouchersPage() {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState([]);
  const [voucherDate, setVoucherDate] = useState("");
  const [voucherType, setVoucherType] = useState("PV");
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState([
    { account_id: "", dc: "D", amount: "", line_narration: "" },
    { account_id: "", dc: "C", amount: "", line_narration: "" },
  ]);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    loadAccounts();
    loadRecent();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await API.get("/accounts");
      setAccounts(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRecent = async () => {
    try {
      const res = await API.get("/vouchers");
      setRecent(res.data.slice(0, 10));
    } catch (err) {
      console.error(err);
    }
  };

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;

    lines.forEach((line) => {
      const amount = Number(line.amount || 0);
      if (line.dc === "D") debit += amount;
      if (line.dc === "C") credit += amount;
    });

    return { debit, credit, balance: debit - credit };
  }, [lines]);

  const setLine = (index, key, value) => {
    const next = [...lines];
    next[index][key] = value;
    setLines(next);
  };

  const addLine = () => {
    setLines([...lines, { account_id: "", dc: "D", amount: "", line_narration: "" }]);
  };

  const removeLine = (index) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const saveVoucher = async () => {
    try {
      if (!voucherDate) {
        alert("Select voucher date");
        return;
      }

      if (totals.balance !== 0) {
        alert("Debit and Credit must match");
        return;
      }

      const payload = {
        voucher_date: voucherDate,
        voucher_type: voucherType,
        narration,
        lines: lines.map((line) => ({
          ...line,
          account_id: Number(line.account_id),
          amount: Number(line.amount),
        })),
      };

      const res = await API.post("/vouchers", payload);

      alert("Voucher Saved: " + res.data.voucher_no);

      setNarration("");
      setLines([
        { account_id: "", dc: "D", amount: "", line_narration: "" },
        { account_id: "", dc: "C", amount: "", line_narration: "" },
      ]);

      loadRecent();
    } catch (error) {
      console.error("Voucher create error:", error);
      alert(
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        "Voucher create failed"
      );
    }
  };

  return (
    <div>
      <div style={styles.pageTitle}>Voucher Management</div>
      <div style={styles.pageSub}>Create and manage accounting vouchers.</div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <h3>Create Voucher</h3>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Voucher Date</label>
              <input
                type="date"
                style={styles.input}
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Voucher Type</label>
              <select
                style={styles.input}
                value={voucherType}
                onChange={(e) => setVoucherType(e.target.value)}
              >
                <option value="PV">Payment Voucher</option>
                <option value="RV">Receipt Voucher</option>
                <option value="JV">Journal Voucher</option>
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Narration</label>
            <input
              style={styles.input}
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
            />
          </div>

          <h4 style={{ marginTop: 18 }}>Voucher Lines</h4>

          {lines.map((line, index) => (
            <div key={index} style={styles.lineGrid}>
              <select
                style={styles.input}
                value={line.account_id}
                onChange={(e) => setLine(index, "account_id", e.target.value)}
              >
                <option value="">Select account</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_code} - {acc.account_name}
                  </option>
                ))}
              </select>

              <select
                style={styles.input}
                value={line.dc}
                onChange={(e) => setLine(index, "dc", e.target.value)}
              >
                <option value="D">Debit</option>
                <option value="C">Credit</option>
              </select>

              <input
                type="number"
                style={styles.input}
                placeholder="Amount"
                value={line.amount}
                onChange={(e) => setLine(index, "amount", e.target.value)}
              />

              <input
                style={styles.input}
                placeholder="Narration"
                value={line.line_narration}
                onChange={(e) => setLine(index, "line_narration", e.target.value)}
              />

              <button style={styles.outlineBtn} onClick={() => removeLine(index)}>
                Remove
              </button>
            </div>
          ))}

          <div style={{ marginTop: 10 }}>
            <button style={styles.outlineBtn} onClick={addLine}>
              Add Line
            </button>
          </div>

          <div style={styles.totals}>
            <div style={styles.totalCard}>
              Debit
              <h2>₹{totals.debit.toFixed(2)}</h2>
            </div>

            <div style={styles.totalCard}>
              Credit
              <h2>₹{totals.credit.toFixed(2)}</h2>
            </div>

            <div style={styles.totalCard}>
              Balance
              <h2 style={{ color: totals.balance === 0 ? "green" : "red" }}>
                ₹{totals.balance.toFixed(2)}
              </h2>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <button style={styles.btn} onClick={saveVoucher}>
              Save Voucher
            </button>
          </div>
        </div>

        <div style={styles.card}>
          <h3>Recent Vouchers</h3>

          {recent.map((v) => (
            <div
              key={v.id}
              style={styles.voucherItem}
              onClick={() => navigate(`/vouchers/${v.id}`)}
            >
              <b>{v.voucher_no}</b>
              <div>{v.voucher_type}</div>
              <div>{v.voucher_date}</div>
              <div>{v.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default VouchersPage;