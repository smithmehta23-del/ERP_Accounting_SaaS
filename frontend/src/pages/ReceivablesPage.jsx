import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  layout: { display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 24 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  field: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155" },
  input: { border: "1px solid #cbd5e1", borderRadius: 14, padding: "12px 14px", fontSize: 14, background: "#fff" },
  btn: { background: "#0f172a", color: "#fff", border: "none", borderRadius: 14, padding: "11px 15px", fontWeight: 600, cursor: "pointer" },
  tableWrap: { border: "1px solid #e2e8f0", borderRadius: 18, overflow: "hidden" },
  tableHead: { display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.9fr 0.9fr", padding: "14px 16px", background: "#f8fafc", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" },
  tableRow: { display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.9fr 0.9fr", padding: "14px 16px", borderTop: "1px solid #e2e8f0", fontSize: 14, alignItems: "center" },
};

function ReceivablesPage() {
  const [parties, setParties] = useState([]);
  const [partyId, setPartyId] = useState("");
  const [invoices, setInvoices] = useState([]);
  const [receipt, setReceipt] = useState({
    receipt_no: "",
    receipt_date: new Date().toISOString().slice(0, 10),
    payment_mode: "BANK",
    reference_no: "",
    remarks: "",
  });
  const [allocations, setAllocations] = useState([]);

  useEffect(() => {
    loadParties();
  }, []);

  const loadParties = async () => {
    const res = await API.get("/outstanding/customers");
    setParties(res.data || []);
  };

  const loadInvoices = async (id) => {
    if (!id) return;
    const res = await API.get(`/outstanding/customer-invoices/${id}`);
    const rows = res.data || [];
    setInvoices(rows);
    setAllocations(rows.map((x) => ({ sales_invoice_id: x.id, allocated_amount: "" })));
  };

  const postReceipt = async () => {
    const payload = {
      party_id: Number(partyId),
      ...receipt,
      allocations: allocations
        .filter((x) => Number(x.allocated_amount || 0) > 0)
        .map((x) => ({
          sales_invoice_id: x.sales_invoice_id,
          allocated_amount: Number(x.allocated_amount),
        })),
    };

    await API.post("/receipts", payload);
    await loadParties();
    await loadInvoices(partyId);
    setReceipt({
      receipt_no: "",
      receipt_date: new Date().toISOString().slice(0, 10),
      payment_mode: "BANK",
      reference_no: "",
      remarks: "",
    });
  };

  return (
    <div>
      <div style={styles.title}>Receivables & Customer Receipts</div>
      <div style={styles.sub}>Manage customer outstanding and allocate receipts invoice-wise.</div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <h3>Customers Outstanding</h3>
          <div style={styles.field}>
            <label style={styles.label}>Customer</label>
            <select
              style={styles.input}
              value={partyId}
              onChange={(e) => {
                setPartyId(e.target.value);
                loadInvoices(e.target.value);
              }}
            >
              <option value="">Select customer</option>
              {parties.map((p) => (
                <option key={p.party_id} value={p.party_id}>
                  {p.party_code} - {p.party_name} | Outstanding: ₹{Number(p.outstanding || 0).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div style={styles.tableWrap}>
            <div style={styles.tableHead}>
              <div>Invoice</div>
              <div>Date</div>
              <div>Balance</div>
              <div>Allocate</div>
            </div>

            {invoices.map((inv, idx) => (
              <div key={inv.id} style={styles.tableRow}>
                <div>{inv.invoice_no}</div>
                <div>{inv.invoice_date}</div>
                <div>₹{Number(inv.balance_amount || 0).toFixed(2)}</div>
                <div>
                  <input
                    style={{ ...styles.input, padding: "8px 10px" }}
                    type="number"
                    value={allocations[idx]?.allocated_amount || ""}
                    onChange={(e) =>
                      setAllocations((prev) =>
                        prev.map((x, i) =>
                          i === idx ? { ...x, allocated_amount: e.target.value } : x
                        )
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <h3>Post Receipt</h3>

          <div style={styles.field}>
            <label style={styles.label}>Receipt No</label>
            <input style={styles.input} value={receipt.receipt_no} onChange={(e) => setReceipt({ ...receipt, receipt_no: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Receipt Date</label>
            <input type="date" style={styles.input} value={receipt.receipt_date} onChange={(e) => setReceipt({ ...receipt, receipt_date: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Payment Mode</label>
            <select style={styles.input} value={receipt.payment_mode} onChange={(e) => setReceipt({ ...receipt, payment_mode: e.target.value })}>
              <option value="BANK">BANK</option>
              <option value="CASH">CASH</option>
            </select>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Reference No</label>
            <input style={styles.input} value={receipt.reference_no} onChange={(e) => setReceipt({ ...receipt, reference_no: e.target.value })} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Remarks</label>
            <input style={styles.input} value={receipt.remarks} onChange={(e) => setReceipt({ ...receipt, remarks: e.target.value })} />
          </div>

          <button style={styles.btn} onClick={postReceipt}>Post Receipt</button>
        </div>
      </div>
    </div>
  );
}

export default ReceivablesPage;