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
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginBottom: 14,
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
  btn: {
    background: "#0f172a",
    color: "#fff",
    border: "none",
    borderRadius: 14,
    padding: "11px 15px",
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  msg: {
    marginTop: 16,
    fontWeight: 600,
    color: "#166534",
  },
};

function SettingsPage() {
  const [accounts, setAccounts] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    sales_account_id: "",
    purchase_account_id: "",
    receivable_account_id: "",
    payable_account_id: "",
    cash_account_id: "",
    bank_account_id: "",
    cgst_output_account_id: "",
    sgst_output_account_id: "",
    igst_output_account_id: "",
    cgst_input_account_id: "",
    sgst_input_account_id: "",
    igst_input_account_id: "",
  });

  useEffect(() => {
    loadAccounts();
    loadSettings();
  }, []);

  const loadAccounts = async () => {
    const res = await API.get("/accounts");
    setAccounts(res.data || []);
  };

  const loadSettings = async () => {
    const res = await API.get("/settings/account-mapping");
    const row = res.data || {};
    setForm({
      sales_account_id: row.sales_account_id || "",
      purchase_account_id: row.purchase_account_id || "",
      receivable_account_id: row.receivable_account_id || "",
      payable_account_id: row.payable_account_id || "",
      cash_account_id: row.cash_account_id || "",
      bank_account_id: row.bank_account_id || "",
      cgst_output_account_id: row.cgst_output_account_id || "",
      sgst_output_account_id: row.sgst_output_account_id || "",
      igst_output_account_id: row.igst_output_account_id || "",
      cgst_input_account_id: row.cgst_input_account_id || "",
      sgst_input_account_id: row.sgst_input_account_id || "",
      igst_input_account_id: row.igst_input_account_id || "",
    });
  };

  const saveSettings = async () => {
    await API.post("/settings/account-mapping", {
      sales_account_id: form.sales_account_id ? Number(form.sales_account_id) : null,
      purchase_account_id: form.purchase_account_id ? Number(form.purchase_account_id) : null,
      receivable_account_id: form.receivable_account_id ? Number(form.receivable_account_id) : null,
      payable_account_id: form.payable_account_id ? Number(form.payable_account_id) : null,
      cash_account_id: form.cash_account_id ? Number(form.cash_account_id) : null,
      bank_account_id: form.bank_account_id ? Number(form.bank_account_id) : null,
      cgst_output_account_id: form.cgst_output_account_id ? Number(form.cgst_output_account_id) : null,
      sgst_output_account_id: form.sgst_output_account_id ? Number(form.sgst_output_account_id) : null,
      igst_output_account_id: form.igst_output_account_id ? Number(form.igst_output_account_id) : null,
      cgst_input_account_id: form.cgst_input_account_id ? Number(form.cgst_input_account_id) : null,
      sgst_input_account_id: form.sgst_input_account_id ? Number(form.sgst_input_account_id) : null,
      igst_input_account_id: form.igst_input_account_id ? Number(form.igst_input_account_id) : null,
    });
    setMessage("Settings saved successfully.");
  };

  const accountOptions = (
    <>
      <option value="">Select account</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.account_code} - {a.account_name}
        </option>
      ))}
    </>
  );

  return (
    <div>
      <div style={styles.title}>Accounting Settings</div>
      <div style={styles.sub}>Configure default accounts used by invoices, settlements, and tax posting.</div>

      <div style={styles.card}>
        <div style={styles.grid}>
          <div style={styles.field}>
            <label style={styles.label}>Sales Account</label>
            <select style={styles.input} value={form.sales_account_id} onChange={(e) => setForm({ ...form, sales_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Purchase Account</label>
            <select style={styles.input} value={form.purchase_account_id} onChange={(e) => setForm({ ...form, purchase_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Receivable Account</label>
            <select style={styles.input} value={form.receivable_account_id} onChange={(e) => setForm({ ...form, receivable_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Payable Account</label>
            <select style={styles.input} value={form.payable_account_id} onChange={(e) => setForm({ ...form, payable_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Cash Account</label>
            <select style={styles.input} value={form.cash_account_id} onChange={(e) => setForm({ ...form, cash_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Bank Account</label>
            <select style={styles.input} value={form.bank_account_id} onChange={(e) => setForm({ ...form, bank_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>CGST Output</label>
            <select style={styles.input} value={form.cgst_output_account_id} onChange={(e) => setForm({ ...form, cgst_output_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>SGST Output</label>
            <select style={styles.input} value={form.sgst_output_account_id} onChange={(e) => setForm({ ...form, sgst_output_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>IGST Output</label>
            <select style={styles.input} value={form.igst_output_account_id} onChange={(e) => setForm({ ...form, igst_output_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>CGST Input</label>
            <select style={styles.input} value={form.cgst_input_account_id} onChange={(e) => setForm({ ...form, cgst_input_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>SGST Input</label>
            <select style={styles.input} value={form.sgst_input_account_id} onChange={(e) => setForm({ ...form, sgst_input_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>IGST Input</label>
            <select style={styles.input} value={form.igst_input_account_id} onChange={(e) => setForm({ ...form, igst_input_account_id: e.target.value })}>
              {accountOptions}
            </select>
          </div>
        </div>

        <button style={styles.btn} onClick={saveSettings}>
          Save Settings
        </button>

        {message ? <div style={styles.msg}>{message}</div> : null}
      </div>
    </div>
  );
}

export default SettingsPage;