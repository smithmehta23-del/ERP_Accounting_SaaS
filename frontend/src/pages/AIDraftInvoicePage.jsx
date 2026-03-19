import React, { useEffect, useState } from "react";
import API from "../api";

function AIDraftInvoicePage() {
  const [drafts, setDrafts] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const res = await API.get("/ai/draft-invoices");
    setDrafts(res.data);
  };

  const approve = async (id) => {
    await API.post(`/ai/approve-draft-invoice/${id}`);
    alert("Invoice created");
    load();
  };

  return (
    <div>
      <h2>AI Draft Purchase Invoices</h2>

      {drafts.map((d) => (
        <div key={d.id} style={{ border: "1px solid #ccc", padding: 10, margin: 10 }}>
          <div><b>Supplier:</b> {d.party_id}</div>
          <div><b>Invoice:</b> {d.invoice_no}</div>
          <div><b>Total:</b> {d.total_amount}</div>

          <button onClick={() => approve(d.id)}>
            Approve & Create Invoice
          </button>
        </div>
      ))}
    </div>
  );
}

export default AIDraftInvoicePage;