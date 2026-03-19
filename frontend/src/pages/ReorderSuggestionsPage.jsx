import React, { useEffect, useState } from "react";
import API from "../api";

function ReorderSuggestionsPage() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const res = await API.get("/reports/reorder-suggestions");
    setRows(res.data);
  };

  return (
    <div>
      <h2>Reorder Suggestions</h2>

      <table border="1" cellPadding="8">
        <thead>
          <tr>
            <th>Item</th>
            <th>Stock</th>
            <th>Reorder</th>
            <th>Suggested Qty</th>
          </tr>
        </thead>

        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.item_code} - {r.item_name}</td>
              <td>{r.balance_qty}</td>
              <td>{r.reorder_level}</td>
              <td><b>{r.suggested_qty}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ReorderSuggestionsPage;