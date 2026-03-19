import React, { useEffect, useState } from "react";
import API from "../api";

function PurchaseOrdersPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const res = await API.get("/purchase-orders");
    setRows(res.data);
  };

  return (
    <div>
      <h2>Purchase Orders</h2>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>PO No</th>
            <th>Date</th>
            <th>Vendor</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.po_no}</td>
              <td>{r.po_date}</td>
              <td>{r.party_name}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PurchaseOrdersPage;