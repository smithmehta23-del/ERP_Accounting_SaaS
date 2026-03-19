import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api";

const emptyLine = () => ({
  item_id: "",
  qty: 1,
  rate: "",
  tax_percent: "",
  description_text: "",
});

function money(v) {
  return `₹${Number(v || 0).toFixed(2)}`;
}

function SalesOrdersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [header, setHeader] = useState({
    customer_id: "",
    so_no: "",
    so_date: new Date().toISOString().slice(0, 10),
    expected_date: "",
    remarks: "",
  });
  const [lines, setLines] = useState([emptyLine()]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    const [partyRes, itemRes, soRes] = await Promise.all([
      API.get("/parties"),
      API.get("/items"),
      API.get("/sales-orders"),
    ]);

    setCustomers(
      (partyRes.data || []).filter(
        (p) => p.party_type === "CUSTOMER" || p.party_type === "BOTH"
      )
    );
    setItems((itemRes.data || []).filter((x) => Number(x.is_active) === 1));
    setOrders(soRes.data || []);
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const updateLine = (index, patch) => {
    setLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const merged = { ...line, ...patch };
        if (patch.item_id !== undefined) {
          const item = items.find((x) => Number(x.id) === Number(patch.item_id));
          if (item) {
            merged.rate = Number(item.sales_rate || 0);
            merged.tax_percent = Number(item.tax_percent || 0);
            merged.description_text = item.item_name || "";
          }
        }
        return merged;
      })
    );
  };

  const computedLines = useMemo(() => {
    return lines.map((line) => {
      const qty = Number(line.qty || 0);
      const rate = Number(line.rate || 0);
      const taxPercent = Number(line.tax_percent || 0);
      const taxable = Number((qty * rate).toFixed(2));
      const taxAmount = Number(((taxable * taxPercent) / 100).toFixed(2));
      const total = Number((taxable + taxAmount).toFixed(2));

      return {
        ...line,
        qty,
        rate,
        tax_percent: taxPercent,
        taxable_amount: taxable,
        tax_amount: taxAmount,
        line_total: total,
      };
    });
  }, [lines]);

  const totalAmount = useMemo(
    () => computedLines.reduce((s, x) => s + Number(x.line_total || 0), 0),
    [computedLines]
  );

  const saveSO = async () => {
    const payload = {
      ...header,
      customer_id: Number(header.customer_id),
      lines: computedLines
        .filter((x) => x.item_id && Number(x.qty) > 0)
        .map((x) => ({
          item_id: Number(x.item_id),
          qty: Number(x.qty),
          rate: Number(x.rate),
          tax_percent: Number(x.tax_percent || 0),
          description_text: x.description_text || "",
        })),
    };

    await API.post("/sales-orders", payload);
    setHeader({
      customer_id: "",
      so_no: "",
      so_date: new Date().toISOString().slice(0, 10),
      expected_date: "",
      remarks: "",
    });
    setLines([emptyLine()]);
    loadAll();
  };

  return (
    <div>
      <h2>Sales Orders</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24, marginBottom: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 20 }}>
          <h3>Create Sales Order</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <select value={header.customer_id} onChange={(e) => setHeader((p) => ({ ...p, customer_id: e.target.value }))}>
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.party_code} - {c.party_name}</option>
              ))}
            </select>
            <input placeholder="SO No" value={header.so_no} onChange={(e) => setHeader((p) => ({ ...p, so_no: e.target.value }))} />
            <input type="date" value={header.so_date} onChange={(e) => setHeader((p) => ({ ...p, so_date: e.target.value }))} />
            <input type="date" value={header.expected_date} onChange={(e) => setHeader((p) => ({ ...p, expected_date: e.target.value }))} />
            <input placeholder="Remarks" value={header.remarks} onChange={(e) => setHeader((p) => ({ ...p, remarks: e.target.value }))} />
          </div>

          <button onClick={addLine}>Add Line</button>

          <div style={{ marginTop: 12 }}>
            {computedLines.map((line, index) => (
              <div key={index} style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.8fr 0.9fr 0.8fr", gap: 8, marginBottom: 8 }}>
                <select value={line.item_id} onChange={(e) => updateLine(index, { item_id: e.target.value })}>
                  <option value="">Select item</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>{item.item_code} - {item.item_name}</option>
                  ))}
                </select>
                <input type="number" value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} />
                <input type="number" value={line.rate} onChange={(e) => updateLine(index, { rate: e.target.value })} />
                <input type="number" value={line.tax_percent} onChange={(e) => updateLine(index, { tax_percent: e.target.value })} />
                <div>{money(line.line_total)}</div>
                <button onClick={() => removeLine(index)}>Remove</button>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, fontWeight: 700 }}>Total: {money(totalAmount)}</div>
          <button style={{ marginTop: 12 }} onClick={saveSO}>Create Sales Order</button>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 20 }}>
          <h3>Sales Order Register</h3>
          {orders.map((row) => (
            <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", padding: "10px 0", borderBottom: "1px solid #eee" }}>
              <button
                style={{ background: "transparent", border: "none", color: "#1d4ed8", cursor: "pointer", textAlign: "left" }}
                onClick={() => navigate(`/sales-orders/${row.id}`)}
              >
                {row.so_no}
              </button>
              <div>{row.party_name}</div>
              <div>{row.so_date}</div>
              <div>{row.status}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SalesOrdersPage;