import React, { useState } from "react";

function Invoice() {
  const [form, setForm] = useState({
    supplier_name: "",
    invoice_date: "",
    amount: ""
  });

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const saveInvoice = async () => {
    try {
      const response = await fetch("http://127.0.0.1:5000/add-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      alert(data.message);

      // Reset form
      setForm({
        supplier_name: "",
        invoice_date: "",
        amount: ""
      });

    } catch (error) {
      alert("Error connecting to backend ❌");
      console.error(error);
    }
  };

  return (
    <div style={{ padding: 30 }}>
      <h2>📄 Add Supplier Invoice</h2>

      <div style={{ marginBottom: 10 }}>
        <input
          name="supplier_name"
          placeholder="Supplier Name"
          value={form.supplier_name}
          onChange={handleChange}
          style={{ padding: 8, width: 250 }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <input
          type="date"
          name="invoice_date"
          value={form.invoice_date}
          onChange={handleChange}
          style={{ padding: 8, width: 250 }}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <input
          type="number"
          name="amount"
          placeholder="Amount"
          value={form.amount}
          onChange={handleChange}
          style={{ padding: 8, width: 250 }}
        />
      </div>

      <button
        onClick={saveInvoice}
        style={{
          padding: "10px 20px",
          backgroundColor: "#2563eb",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}
      >
        Save Invoice
      </button>
    </div>
  );
}

export default Invoice;
