import React, { useState } from "react";
import { apiPost } from "./api";

function SupplierInvoice() {
  const [invoice, setInvoice] = useState({
    supplier: "",
    date: "",
    invoice_no: "",
    taxable_amount: 0,
    gst_amount: 0,
  });

  const total = Number(invoice.taxable_amount) + Number(invoice.gst_amount);

  const handleChange = (e) => {
    setInvoice({ ...invoice, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    const res = await apiPost("/create_supplier_invoice", {
      ...invoice,
      total_amount: total,
    });
    alert(res.message);
  };

  return (
    <div>
      <h2>Supplier Invoice</h2>
      <input name="supplier" placeholder="Supplier Name" onChange={handleChange} />
      <input type="date" name="date" onChange={handleChange} />
      <input name="invoice_no" placeholder="Invoice No" onChange={handleChange} />
      <input name="taxable_amount" placeholder="Taxable Amount" onChange={handleChange} />
      <input name="gst_amount" placeholder="GST Amount" onChange={handleChange} />
      <h3>Total: {total}</h3>
      <button onClick={handleSubmit}>Save (Pre-Approve)</button>
    </div>
  );
}

export default SupplierInvoice;
