import React, { useEffect, useState } from "react";
import API from "../api";

const styles = {
  title: { fontSize: 30, fontWeight: 700, marginBottom: 8 },
  sub: { color: "#64748b", marginBottom: 24 },
  layout: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    boxShadow: "0 4px 18px rgba(15,23,42,0.05)",
  },
  field: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: 600, color: "#334155" },
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
  listWrap: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 14,
  },
  listHead: {
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr 1fr 1fr 1fr",
    padding: "14px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    textTransform: "uppercase",
  },
  listRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1.2fr 1fr 1fr 1fr",
    padding: "14px 16px",
    borderTop: "1px solid #e2e8f0",
    fontSize: 14,
    alignItems: "center",
    cursor: "pointer",
  },
};

function SettlementsPage() {
  const [openSales, setOpenSales] = useState([]);
  const [openPurchases, setOpenPurchases] = useState([]);

  const [salesSelected, setSalesSelected] = useState(null);
  const [purchaseSelected, setPurchaseSelected] = useState(null);

  const [receiptDate, setReceiptDate] = useState("");
  const [receiptAmount, setReceiptAmount] = useState("");

  const [paymentDate, setPaymentDate] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");

  useEffect(() => {
    loadOpenSales();
    loadOpenPurchases();
  }, []);

  const loadOpenSales = async () => {
    const res = await API.get("/sales-invoices/open");
    setOpenSales(res.data || []);
  };

  const loadOpenPurchases = async () => {
    const res = await API.get("/purchase-invoices/open");
    setOpenPurchases(res.data || []);
  };

  const postReceipt = async () => {
    if (!salesSelected) return;
    await API.post(`/sales-invoices/${salesSelected.id}/receive`, {
      receipt_date: receiptDate,
      amount: Number(receiptAmount),
    });
    setReceiptAmount("");
    loadOpenSales();
  };

  const postPayment = async () => {
    if (!purchaseSelected) return;
    await API.post(`/purchase-invoices/${purchaseSelected.id}/pay`, {
      payment_date: paymentDate,
      amount: Number(paymentAmount),
    });
    setPaymentAmount("");
    loadOpenPurchases();
  };

  return (
    <div>
      <div style={styles.title}>Invoice Settlements</div>
      <div style={styles.sub}>Post receipts against customer invoices and payments against vendor invoices.</div>

      <div style={styles.layout}>
        <div style={styles.card}>
          <h3>Customer Receipts</h3>

          <div style={styles.field}>
            <label style={styles.label}>Selected Invoice</label>
            <input
              style={styles.input}
              readOnly
              value={
                salesSelected
                  ? `${salesSelected.invoice_no} | ${salesSelected.party_name} | Balance ₹${Number(
                      salesSelected.balance_amount
                    ).toFixed(2)}`
                  : ""
              }
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Receipt Date</label>
            <input type="date" style={styles.input} value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Receipt Amount</label>
            <input type="number" style={styles.input} value={receiptAmount} onChange={(e) => setReceiptAmount(e.target.value)} />
          </div>

          <button style={styles.btn} onClick={postReceipt}>Post Receipt</button>

          <div style={styles.listWrap}>
            <div style={styles.listHead}>
              <div>Invoice</div>
              <div>Party</div>
              <div>Date</div>
              <div>Total</div>
              <div>Balance</div>
            </div>

            {openSales.map((r) => (
              <div key={r.id} style={styles.listRow} onClick={() => setSalesSelected(r)}>
                <div>{r.invoice_no}</div>
                <div>{r.party_name}</div>
                <div>{r.invoice_date}</div>
                <div>₹{Number(r.amount).toFixed(2)}</div>
                <div><b>₹{Number(r.balance_amount).toFixed(2)}</b></div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <h3>Vendor Payments</h3>

          <div style={styles.field}>
            <label style={styles.label}>Selected Invoice</label>
            <input
              style={styles.input}
              readOnly
              value={
                purchaseSelected
                  ? `${purchaseSelected.invoice_no} | ${purchaseSelected.party_name} | Balance ₹${Number(
                      purchaseSelected.balance_amount
                    ).toFixed(2)}`
                  : ""
              }
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Payment Date</label>
            <input type="date" style={styles.input} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Payment Amount</label>
            <input type="number" style={styles.input} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          </div>

          <button style={styles.btn} onClick={postPayment}>Post Payment</button>

          <div style={styles.listWrap}>
            <div style={styles.listHead}>
              <div>Invoice</div>
              <div>Party</div>
              <div>Date</div>
              <div>Total</div>
              <div>Balance</div>
            </div>

            {openPurchases.map((r) => (
              <div key={r.id} style={styles.listRow} onClick={() => setPurchaseSelected(r)}>
                <div>{r.invoice_no}</div>
                <div>{r.party_name}</div>
                <div>{r.invoice_date}</div>
                <div>₹{Number(r.amount).toFixed(2)}</div>
                <div><b>₹{Number(r.balance_amount).toFixed(2)}</b></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettlementsPage;