import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../api";

function money(v) {
  return `₹${Number(v || 0).toFixed(2)}`;
}

function SalesOrderDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    const res = await API.get(`/sales-orders/${id}`);
    setData(res.data);
  };

  const changeStatus = async (status) => {
    await API.post(`/sales-orders/${id}/status`, { status });
    loadData();
  };

  const convertToInvoice = async () => {
    await API.post(`/sales-orders/${id}/convert-to-invoice`, {
      invoice_no: invoiceNo,
      invoice_date: invoiceDate,
    });
    loadData();
  };

  return (
    <div>
      <h2>Sales Order Details</h2>

      {!data ? (
        <div>Loading sales order...</div>
      ) : (
        <>
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 20, marginBottom: 20 }}>
            <h3>{data.header.so_no}</h3>
            <div>Customer: {data.header.party_code} - {data.header.party_name}</div>
            <div>SO Date: {data.header.so_date}</div>
            <div>Expected Date: {data.header.expected_date || "-"}</div>
            <div>Status: {data.header.status}</div>
            <div>Total: <b>{money(data.header.total_amount)}</b></div>

            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              <button onClick={() => navigate("/sales-orders")}>Back</button>
              <button onClick={() => changeStatus("CONFIRMED")}>Confirm</button>
              <button onClick={() => changeStatus("PARTIAL")}>Mark Partial</button>
              <button onClick={() => changeStatus("CLOSED")}>Mark Closed</button>
              <button onClick={() => changeStatus("CANCELLED")}>Cancel</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20 }}>
              <input placeholder="Sales Invoice No" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </div>

            <button style={{ marginTop: 12 }} onClick={convertToInvoice}>
              Convert to Sales Invoice
            </button>
          </div>

          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 20 }}>
            <h3>SO Lines</h3>
            {data.lines.map((line) => (
              <div key={line.id} style={{ display: "grid", gridTemplateColumns: "1.5fr 0.8fr 0.8fr 0.8fr 0.9fr", padding: "10px 0", borderBottom: "1px solid #eee" }}>
                <div>{line.item_code} - {line.item_name}</div>
                <div>{Number(line.qty || 0).toFixed(3)} {line.unit || ""}</div>
                <div>{money(line.rate)}</div>
                <div>{Number(line.tax_percent || 0).toFixed(2)}%</div>
                <div><b>{money(line.line_total)}</b></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default SalesOrderDetailsPage;