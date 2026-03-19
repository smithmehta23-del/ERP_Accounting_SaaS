import React, { useEffect, useState } from "react";
import api from "./api";

function Invoice() {
  const [accounts, setAccounts] = useState([]);
  const [voucherDate, setVoucherDate] = useState("");
  const [voucherType, setVoucherType] = useState("PV");
  const [narration, setNarration] = useState("");
  const [message, setMessage] = useState("");

  const [lines, setLines] = useState([
    { account_id: "", dc: "D", amount: "", line_narration: "" },
    { account_id: "", dc: "C", amount: "", line_narration: "" },
  ]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const res = await api.get("/api/accounts");
      setAccounts(res.data || []);
    } catch (err) {
      setMessage(
        err?.response?.data?.message || "Failed to load accounts"
      );
    }
  };

  const updateLine = (index, field, value) => {
    const updated = [...lines];
    updated[index][field] = value;
    setLines(updated);
  };

  const addLine = () => {
    setLines([
      ...lines,
      { account_id: "", dc: "D", amount: "", line_narration: "" },
    ]);
  };

  const removeLine = (index) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const saveVoucher = async () => {
    setMessage("");

    try {
      const payload = {
        voucher_date: voucherDate,
        voucher_type: voucherType,
        narration,
        lines: lines.map((line) => ({
          account_id: Number(line.account_id),
          dc: line.dc,
          amount: Number(line.amount),
          line_narration: line.line_narration,
        })),
      };

      const res = await api.post("/api/vouchers", payload);
      setMessage(res.data?.message || "Voucher saved successfully");

      setVoucherDate("");
      setVoucherType("PV");
      setNarration("");
      setLines([
        { account_id: "", dc: "D", amount: "", line_narration: "" },
        { account_id: "", dc: "C", amount: "", line_narration: "" },
      ]);
    } catch (err) {
      setMessage(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Voucher save failed"
      );
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>Create Voucher</h2>

      <div style={{ marginBottom: 12 }}>
        <label>Voucher Date</label>
        <br />
        <input
          type="date"
          value={voucherDate}
          onChange={(e) => setVoucherDate(e.target.value)}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Voucher Type</label>
        <br />
        <select
          value={voucherType}
          onChange={(e) => setVoucherType(e.target.value)}
        >
          <option value="PV">PV</option>
          <option value="RV">RV</option>
          <option value="JV">JV</option>
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Narration</label>
        <br />
        <input
          type="text"
          value={narration}
          onChange={(e) => setNarration(e.target.value)}
          placeholder="Narration"
          style={{ width: 300 }}
        />
      </div>

      <h3>Voucher Lines</h3>

      {lines.map((line, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 10,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            value={line.account_id}
            onChange={(e) => updateLine(index, "account_id", e.target.value)}
          >
            <option value="">Select Account</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_code} - {acc.account_name}
              </option>
            ))}
          </select>

          <select
            value={line.dc}
            onChange={(e) => updateLine(index, "dc", e.target.value)}
          >
            <option value="D">Debit</option>
            <option value="C">Credit</option>
          </select>

          <input
            type="number"
            placeholder="Amount"
            value={line.amount}
            onChange={(e) => updateLine(index, "amount", e.target.value)}
          />

          <input
            type="text"
            placeholder="Line Narration"
            value={line.line_narration}
            onChange={(e) =>
              updateLine(index, "line_narration", e.target.value)
            }
          />

          <button onClick={() => removeLine(index)}>Remove</button>
        </div>
      ))}

      <div style={{ marginBottom: 12 }}>
        <button onClick={addLine}>Add Line</button>
      </div>

      <button onClick={saveVoucher}>Save Voucher</button>

      {message ? <p style={{ marginTop: 16 }}>{message}</p> : null}
    </div>
  );
}

export default Invoice;